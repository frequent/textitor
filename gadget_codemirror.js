/*jslint indent: 2, vars: true, nomen: true, maxerr: 3 */
/*global window, document, rJS, CodeMirror, JSON, loopEventListener */

(function (window, document, rJS, CodeMirror, JSON, loopEventListener) {
  "use strict";

  /////////////////////////////
  // Placeholder Instructions
  /////////////////////////////
  var PLACEHOLDER = "Textitor Shortcuts:\n" +
    "[CTRL+ALT+x] Close Dialog";

  /////////////////////////////
  // Supported Languages
  /////////////////////////////
  var MODEMIMES = {
    "undefined": "text/plain",
    "null": "text/plain",
    "css": "text/css",
    "javascript": "application/javascript",
    "htmlmixed": "text/html",
    "xml": "application/xml",
    "json": "application/json",
    "python": "text/x-python",
    "markdown": "text/x-markdown",
    "php": "text/x-php",
    "diff": "text/x-diff",
    "sql": "text/x-sql",
  };

  var SHIMMODEMIMES = {
    "html": "htmlmixed",
    "js": "javascript",
    "py": "python",
    "md": "markdown"
  };

  /////////////////////////////
  // Templates
  /////////////////////////////
  var FILE_MENU_TEMPLATE = "<div class='custom-file-menu'>%s</div>";

  var FILE_ENTRY_TEMPLATE = "<div class='custom-file-menu-row'>" +
      "<input type='checkbox' autocomplete='off' />" +
      "<span class='custom-file-menu-checkbox-overlay'>%s</span>" +
      "</div>";
  
  var OBJECT_MENU_TEMPLATE = "<span class='custom-menu-label'>Name:</span>" +
    "<input type='text' tabindex='1' placeholder='file name' value='%s' />" +
    "<input type='hidden' value='%s' />" +
    "<span class='custom-menu-label'>Create as Cache</span>" +
    "<input type='checkbox' tabindex='2' autocomplete='off' />" +
    "<span class='custom-menu-typewriter'>CTRL+ALT+</span>" +
    "<form name='save'>" +
      "<button type='submit' tabindex='3' class='custom-menu-button'>" +
        "<b>S</b>ave</button></form>" +
    "<form name='close'>" +
      "<button type='submit' tabindex='4' class='custom-menu-button'>" +
        "<b>C</b>lose</button></form>" +
    "<form name='remove'>" +
      "<button type='submit' tabindex='5' class='custom-menu-button'>" + 
        "<b>D</b>elete</button></form>";

  var OBJECT_LIST_TEMPLATE = "<span>Search:</span>" +
    "<input type='text' tabindex='1' placeholder='search...' />" +
    "<span class='custom-menu-typewriter'>CTRL+ALT+</span>" +
    "<form name='search'>" +
      "<button type='submit' tabindex='2' class='custom-menu-button'>" +
        "<b>F</b>ind</button></form>" +
    "<form name='saveall'>" +
      "<button type='submit' tabindex='3' class='custom-menu-button'>" +
        "<b>S</b>ave All</button></form>";

  /////////////////////////////
  // Event handling (gadget_global.js)
  /////////////////////////////
  function promiseEventListener(target, type, useCapture) {
    //////////////////////////
    var handle_event_callback;

    function canceller() {
      target.removeEventListener(type, handle_event_callback, useCapture);
    }

    function resolver(resolve) {
      handle_event_callback = function (evt) {
        canceller();
        evt.stopPropagation();
        evt.preventDefault();
        resolve(evt);
        return false;
      };
      target.addEventListener(type, handle_event_callback, useCapture);
    }
    return new RSVP.Promise(resolver, canceller);
  }

  // CUSTOM loopEventListener for CodeMirror events (non DOM)
  function codeMirrorLoopEventListener(target, type, callback) {
    var handle_event_callback,
      callback_promise;

    function cancelResolver() {
      if ((callback_promise !== undefined) &&
        (typeof callback_promise.cancel === "function")) {
        callback_promise.cancel();
      }
    }
    function canceller() {
      if (handel_event_callback !== undefined) {
        CodeMirror.off(target, type, handle_event_callback);
      }
      cancelResolver();
    }
    function itsANonResolvableTrap(resolve, reject) {
      handle_event_callback = function (evt) {
        cancelResolver();
        callback_promise = new RSVP.Queue()
          .push(function () {
            return callback(evt);
          })
          .push(undefined, function (error) {
            if (!(error instanceof RSVP.CancellationError)) {
              canceller();
              reject(error);
            }
          });
      };
      CodeMirror.on(target, type, handle_event_callback);
    }
    return new RSVP.Promise(itsANonResolvableTrap, canceller);
  }

  /////////////////////////////
  // Some Methods
  /////////////////////////////

  // CodeMirror needs this on dialog close
  function closeNotification(my_editor, my_newVal) {
    if (my_editor.state.currentNotificationClose) {
      my_editor.state.currentNotificationClose();
    }
    my_editor.state.currentNotificationClose = my_newVal;
  }

  // validate mime type
  function is_validMimeType(my_mime_type) {
    var mime;
    for (mime in MODEMIMES) {
      if (MODEMIMES.hasOwnProperty(mime)) {
        if (my_mime_type == MODEMIMES[mime]) {
          return true;
        }
      }
    }
  }

  // test 404
  function is404(my_error) {
    if ((my_error instanceof jIO.util.jIOError) &&
      (my_error.status_code === 404)) {
      return true;
    }
    return null;
  }

  /////////////////////////////
  // CodeMirror Custom menu_dict Extension
  /////////////////////////////
  CodeMirror.menu_dict = {};
  CodeMirror.menu_dict.editor = null;
  CodeMirror.menu_dict.editor_active_dialog = null;
  CodeMirror.menu_dict.editor_active_file = null;
  CodeMirror.menu_dict.editor_active_cache = null;
  CodeMirror.menu_dict.editor_is_modified = null;
  CodeMirror.menu_dict.dialog = null;
  CodeMirror.menu_dict.dialog_position = "idle";
  CodeMirror.menu_dict.dialog_option_dict = {
    "bottom": false,
    "closeOnEnter": false,
    "closeOnBlur": false,
    "value": null,
    "selectValueOnOpen": false,
    "onKeyUp": function (my_event, my_value, my_callback) {
      return CodeMirror.menu_dict.dialog_setNavigationCallback(
        my_event,
        my_value,
        my_callback
      );
    },
    "onInput": function (my_event, my_value, my_callback) {
      return CodeMirror.menu_dict.dialog_setNavigationCallback(
        my_event,
        my_value, 
        my_callback
      );
    },
    "onSubmit": function (my_event, my_value, my_callback) {
      return my_callback(my_event);
    }
  };

  function editor_createDoc(my_content) {
    var new_doc,content, history;

    if (my_content && my_content.length) {
      content = my_content[0].target.result;
      history = my_content[1].target.result;
      new_doc = CodeMirror.Doc(content);
      if (history) {
        new_doc.setHistory(JSON.parse(history));
      }
     return new_doc;
    }
    return CodeMirror.Doc("");
  }

  function editor_setDialog(my_editor, my_template, my_bottom) {
    var wrap = my_editor.getWrapperElement(),
      dialog = wrap.appendChild(document.createElement("div"));

    if (my_bottom) {
      dialog.className = "CodeMirror-dialog CodeMirror-dialog-bottom";
    } else {
      dialog.className = "CodeMirror-dialog CodeMirror-dialog-top";
    }
    if (typeof my_template == "string") {
      dialog.innerHTML = my_template;
    } else {
      dialog.appendChild(my_template);
    }
    return dialog;
  }

  // modified flag
  function editor_setModified() {
    var props = CodeMirror.menu_dict;
    if (props.editor_is_modified !== true) {
      props.editor_is_modified = true;
      props.element.querySelector(".CodeMirror").className += " custom-set-modified";
    }
  }

  function editor_resetModified() {
    var props = CodeMirror.menu_dict,
      element = props.element.querySelector(".CodeMirror");

    props.editor_is_modified = null;
    element.className = element.className.split("custom-set-modified").join("");
  }

  // active flag
  function editor_resetActiveFile() {
    CodeMirror.menu_dict.editor_active_file = null;
  }

  function editor_setActiveFile(my_name, my_mime_type) {
    CodeMirror.menu_dict.editor_active_file = CodeMirror.menu_dict.editor_active_file || {};
    CodeMirror.menu_dict.editor_active_file.name = my_name;
    CodeMirror.menu_dict.editor_active_file.mime_type = my_mime_type;
  }

  function editor_getActiveFile() {
    var active_file = CodeMirror.menu_dict.editor_active_file || {};
    return [active_file.name || "", active_file.mime_type || ""];
  }
  
  function editor_getActiveFileList(my_gadget) {
    return new RSVP.Queue()
      .push(function () {
        return my_gadget.setActiveStorage("memory");
      })
      .push(function () {
        return my_gadget.jio_allDocs();
      })
      .push(function (my_directory_list) {
        var response_dict = my_directory_list.data,
          directory_content_list = [],
          cache_id,
          i;
  
        for (i = 0; i < response_dict.total_rows; i += 1) {
          cache_id = response_dict.rows[i].id;
          directory_content_list.push(
            my_gadget.jio_allAttachments(cache_id)
          );
        }
        return RSVP.all(directory_content_list);
      });
  }

  function dialog_flagInput(my_input, my_message) {
    if (my_input.className.indexOf("custom-invalid") > 0) {
      return false;
    }
    return new RSVP.Queue()
      .push(function () {
        my_input.className += ' custom-invalid';
        my_input.value = my_message;
        my_input.blur();
        CodeMirror.menu_dict.editor.focus();
        console.log("focus bind")
        return promiseEventListener(my_input, 'focus', false);
      })
      .push(function () {
        console.log("focus trigger")
        my_input.className = '';
        my_input.value = '';
        
        // keep menu open
        return false;
      });
  }

  // dialog
  function dialog_parseTemplate(my_template, my_value_list) {
    var html_content = [],
      counter = 0,
      setHtmlContent = function (my_content_list) {
        return function (my_snippet) {
          var value = my_value_list[counter] || "";
          my_content_list.push(my_snippet + value);
          counter += 1;
        };
      };
    my_template.split("%s").map(setHtmlContent(html_content));
    return html_content.join("");
  }

  function dialog_createFileMenu(my_file_dict) {
    var str = "",
      div,
      i,
      len,
      folder,
      counter;

    for (counter in my_file_dict) {
      if (my_file_dict.hasOwnProperty(counter)) {
        folder = my_file_dict[counter];
        for (i = 0, len = folder.item_list.length; i < len; i += 1) {
          str += CodeMirror.menu_dict.dialog_parseTemplate(
            FILE_ENTRY_TEMPLATE,
            [folder.name + " | " + folder.item_list[i]]
          );
        }
      }
    }
    // XXX: WTFix
    str = CodeMirror.menu_dict.dialog_parseTemplate(FILE_MENU_TEMPLATE, [str]);
    div = document.createElement("div");
    div.innerHTML = str;
    return div.firstChild;
  }

  function dialog_updateFileMenu(my_direction) {
    var file_menu = CodeMirror.menu_dict.dialog.querySelector(".custom-file-menu"),
      input_list,
      input_element,
      selected_index,
      len,
      i;
    
    if (file_menu) {
      input_list = Array.prototype.slice.call(
        file_menu.querySelectorAll('input[type="checkbox"]')
      ),
      input_element,
      len,
      i;

      for (i = 0, len = input_list.length; i < len; i += 1) {
        if (input_list[i].checked) {
          selected_index = i;
          input_list[i].checked = false;
        }
      }
      if (my_direction === "down") {
        selected_index = selected_index || len;
        input_element = input_list[selected_index - 1] || input_list[len - 1];
      } else {
        selected_index = selected_index || 0;
        input_element = input_list[selected_index + 1] || input_list[0];
      }
      input_element.checked = true;
    }
  }

  function dialog_clearTextInput(my_dialog) {
    var input_list = my_dialog.querySelectorAll("input"),
      len,
      i;
    console.log(input_list)
    for (i = 0, len = input_list.length; i < len; i += 1) {
      if (input_list[i].type === 'text') {
        console.log("clearing", input_list[i].value)
        input_list[i].value = '';
      }
    }
  }

  function dialog_evaluateState(my_parameter) {
    var props = CodeMirror.menu_dict;
    return new RSVP.Queue()
      .push(function () {
        return props.editor_updateStorage(my_parameter);
      })
      .push(function (my_close_dialog) {
        console.log("done, dialog?", props.editor_active_dialog, my_close_dialog);
        if (my_close_dialog === true && props.editor_active_dialog) {
          if (props.dialog_option_dict.onClose) {
            props.dialog_option_dict.onClose(dialog);
          }
          props.dialog.parentNode.removeChild(props.dialog);
          props.editor_active_dialog = null;
          props.editor.focus();
          props.dialog_position = "idle";
        }
      })
      .push(null, function (error) {
        console.log(error);
        throw error;
      });
  }

  function dialog_setNavigationMenu(my_direction) {
    switch (CodeMirror.menu_dict.dialog_position) {
      case "idle":
        CodeMirror.menu_dict.dialog_position = my_direction;
        if (my_direction === "right") {
          return CodeMirror.menu_dict.dialog_parseTemplate(
            OBJECT_MENU_TEMPLATE,
            CodeMirror.menu_dict.editor_getActiveFile()
          );
        }
        return OBJECT_LIST_TEMPLATE;
      case "left":
        if (my_direction === "left") {
          return OBJECT_LIST_TEMPLATE;
        }
        CodeMirror.menu_dict.dialog_position = "idle";
        return;
      case "right":
        if (my_direction === "left") {
          CodeMirror.menu_dict.dialog_position = "idle";
          return;
        }
        return OBJECT_LIST_TEMPLATE;
    }
  }

  function dialog_setNavigationCallback(my_event, my_value, my_callback) {

    // esc
    if (my_event.keyCode === 27) {
      return CodeMirror.commands.myEditor_closeDialog();
    }

    // overide chrome page start/end shortcut
    if (my_event.keyCode === 35) {
      return CodeMirror.commands.myEditor_navigateVertical(undefined, "up");
    }
    if (my_event.keyCode === 36) {
      return CodeMirror.commands.myEditor_navigateVertical(undefined, "down");
    }
    // input
    if (my_event.type === "input") {
      return my_callback(my_value);
    }

    // ctrl + alt +
    if (my_event.ctrlKey && my_event.altKey) {
      switch(my_event.keyCode) {
        case 68: return CodeMirror.commands.myEditor_deleteFile();  // (d)elete file
        case 67: return CodeMirror.commands.myEditor_closeFile();   // (c)lose file
        case 79: return CodeMirror.commands.myEditor_openFromDialog(); // (o)pen
        case 83: return CodeMirror.commands.myEditor_saveFromDialog(CodeMirror);// (s)ave
        case 88: return CodeMirror.commands.myEditor_closeDialog(); // (x)lose dialog
        case 37: return CodeMirror.commands.myEditor_navigateHorizontal(undefined, "left");
        case 39: return CodeMirror.commands.myEditor_navigateHorizontal(undefined, "right");
        case 38: return CodeMirror.commands.myEditor_navigateVertical(undefined, "up");
        case 40: return CodeMirror.commands.myEditor_navigateVertical(undefined, "down");
      }
    }
  }

  CodeMirror.menu_dict.editor_createDoc = editor_createDoc;
  CodeMirror.menu_dict.editor_setDialog = editor_setDialog;
  CodeMirror.menu_dict.editor_setModified = editor_setModified;
  CodeMirror.menu_dict.editor_resetModified = editor_resetModified;
  CodeMirror.menu_dict.editor_resetActiveFile = editor_resetActiveFile;
  CodeMirror.menu_dict.editor_setActiveFile = editor_setActiveFile;
  CodeMirror.menu_dict.editor_getActiveFile = editor_getActiveFile;
  CodeMirror.menu_dict.editor_getActiveFileList = editor_getActiveFileList;
  //CodeMirror.menu_dict.editor_updateStorage = editor_updateStorage;
  CodeMirror.menu_dict.dialog_flagInput = dialog_flagInput;
  CodeMirror.menu_dict.dialog_parseTemplate = dialog_parseTemplate;
  CodeMirror.menu_dict.dialog_createFileMenu = dialog_createFileMenu;
  CodeMirror.menu_dict.dialog_updateFileMenu = dialog_updateFileMenu;
  CodeMirror.menu_dict.dialog_clearTextInput = dialog_clearTextInput;
  CodeMirror.menu_dict.dialog_evaluateState = dialog_evaluateState;
  CodeMirror.menu_dict.dialog_closeCallback = function () {};
  CodeMirror.menu_dict.dialog_setNavigationMenu = dialog_setNavigationMenu;
  CodeMirror.menu_dict.dialog_setNavigationCallback = dialog_setNavigationCallback;

  /////////////////////////////
  // CodeMirror Custom keyMap Extension (thx Tristan)
  /////////////////////////////
  CodeMirror.keyMap.my = {"fallthrough": "default"};

  // CodeMirror.keyMap.my["Ctrl-Alt-A"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-B"] = undefined;
  CodeMirror.keyMap.my["Ctrl-Alt-C"] = "myEditor_closeFile";
  CodeMirror.keyMap.my["Ctrl-Alt-D"] = "myEditor_deleteFile";
  // CodeMirror.keyMap.my["Ctrl-Alt-E"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-F"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-G"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-H"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-I"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-J"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-K"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-L"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-M"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-N"] = undefined;
  CodeMirror.keyMap.my["Ctrl-Alt-O"] = "myEditor_openFromDialog";
  // CodeMirror.keyMap.my["Ctrl-Alt-P"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-Q"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-R"] = undefined;
  CodeMirror.keyMap.my["Ctrl-Alt-S"] = "myEditor_saveFromDialog";
  // CodeMirror.keyMap.my["Ctrl-Alt-T"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-U"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-V"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-W"] = undefined;
  CodeMirror.keyMap.my["Ctrl-Alt-X"] = "myEditor_closeDialog";
  // CodeMirror.keyMap.my["Ctrl-Alt-Y"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-Z"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt--"] = undefined;
  CodeMirror.keyMap.my["Ctrl-Alt-Home"] = "myEditor_navigateUp";
  CodeMirror.keyMap.my["Ctrl-Alt-End"] = "myEditor_navigateDown";
  CodeMirror.keyMap.my["Ctrl-Alt-Right"] = "myEditor_navigateRight";
  CodeMirror.keyMap.my["Ctrl-Alt-Left"] = "myEditor_navigateLeft";
  CodeMirror.keyMap.my["Ctrl-Alt-Up"] = "myEditor_navigateUp";
  CodeMirror.keyMap.my["Ctrl-Alt-Down"] = "myEditor_navigateDown";
  // CodeMirror.keyMap.my["Ctrl-Alt-Return"] = undefined;


  /////////////////////////////
  // CodeMirror Commands Extensions (shortcut calls)
  /////////////////////////////
  function editor_closeFile() {
    if (CodeMirror.menu_dict.dialog_evaluateState) {
      return CodeMirror.menu_dict.dialog_evaluateState({"target":{"name": "close"}});
    }
  }

  function editor_deleteFile() {
    if (CodeMirror.menu_dict.dialog_evaluateState) {
      return CodeMirror.menu_dict.dialog_evaluateState({"target": {"name": "remove"}});
    }
  }

  function editor_closeDialog() {
    if (CodeMirror.menu_dict.dialog_evaluateState) {
      return CodeMirror.menu_dict.dialog_evaluateState(true);
    }
  }

  function editor_openDialog(my_codemirror, my_direction) {
    return new RSVP.Queue()
      .push(function () {
        return my_codemirror.openDialog(
          CodeMirror.menu_dict.dialog_setNavigationMenu(my_direction),
          CodeMirror.menu_dict.dialog_closeCallback,
          CodeMirror.menu_dict.dialog_option_dict
        );
      });
  }

  function editor_saveFromDialog(my_codemirror, from) {
    if (CodeMirror.menu_dict.dialog_position !== "left") {

      // evaluateState is declared on first dialog open, if someone saves before
      // opening, it would raise an error so we default to opening the dialog
      if (CodeMirror.menu_dict.dialog_evaluateState) {
        return CodeMirror.menu_dict.dialog_evaluateState({"target":{"name": "save"}});
      } else {
        return CodeMirror.commands.myEditor_openDialog(CodeMirror, "right");
      }
    }
  }

  function editor_openFromDialog() {
    if (CodeMirror.menu_dict.dialog_position === "left") {
      return CodeMirror.menu_dict.dialog_evaluateState({"target":{"name": "open"}});
    }
  }

  function editor_navigateHorizontal(my_codemirror, my_direction) {
    var position = CodeMirror.menu_dict.dialog_position,
      parameter;

    if (position === "idle") {
      return my_codemirror.openDialog(
        CodeMirror.menu_dict.dialog_setNavigationMenu(my_direction),
        CodeMirror.menu_dict.dialog_closeCallback,
        CodeMirror.menu_dict.dialog_option_dict
      );
    }
    if (position === my_direction) {
      parameter = false;
    }
    if (position === "right" && my_direction == "left") {
      parameter = true;
    }
    if (position === "left" && my_direction === "right") {
      parameter = {"target": {"name": "open"}};
    }
    return CodeMirror.menu_dict.dialog_evaluateState(parameter);
  }

  function editor_navigateVertical(my_codemirror, my_direction) {
    return CodeMirror.menu_dict.dialog_updateFileMenu(my_direction);
  }

  function editor_navigateRight(cm) {
    return CodeMirror.commands.myEditor_navigateHorizontal(cm, "right");
  }

  function editor_navigateLeft(cm) {
    return CodeMirror.commands.myEditor_navigateHorizontal(cm, "left");
  }

  function editor_navigateUp(cm) {
    return CodeMirror.commands.myEditor_navigateVertical(cm, "up");
  }

  function editor_navigateDown(cm) {
    return CodeMirror.commands.myEditor_navigateVertical(cm, "down");
  }

  CodeMirror.commands.myEditor_closeFile = editor_closeFile;
  CodeMirror.commands.myEditor_deleteFile = editor_deleteFile;
  CodeMirror.commands.myEditor_closeDialog = editor_closeDialog;
  CodeMirror.commands.myEditor_openDialog = editor_openDialog;
  CodeMirror.commands.myEditor_saveFromDialog = editor_saveFromDialog;
  CodeMirror.commands.myEditor_openFromDialog = editor_openFromDialog;
  CodeMirror.commands.myEditor_navigateHorizontal = editor_navigateHorizontal;
  CodeMirror.commands.myEditor_navigateVertical = editor_navigateVertical;
  CodeMirror.commands.myEditor_navigateRight = editor_navigateRight;
  CodeMirror.commands.myEditor_navigateLeft = editor_navigateLeft;
  CodeMirror.commands.myEditor_navigateUp = editor_navigateUp;
  CodeMirror.commands.myEditor_navigateDown = editor_navigateDown;


  rJS(window)

    /////////////////////////////
    // ready
    /////////////////////////////

    // Init local properties with CodeMirror custom properties
    .ready(function (my_gadget) {
      var props = my_gadget.property_dict = CodeMirror.menu_dict;
      return my_gadget.getElement()
        .push(function (my_element) {
          props.element = my_element;
          props.textarea = document.createElement("textarea");
          props.element.appendChild(props.textarea);
        });
    })
    
    // Init CodeMirror methods which require gadget to be passed as parameter
    .ready(function (my_gadget){
      
      function editor_updateStorage(my_parameter) {
        var action;

        // returning true closes panel, false leaves it open

        if (my_parameter) {
          if (my_parameter.target) {
            action = my_parameter.target.name;
            if (action === "open") {
            return my_gadget.editor_openFile();
            }
            if (action === "close") {
              return my_gadget.editor_swapFile();
            }
            if (action === "save") {
              return my_gadget.editor_saveFile();
            }
            if (action === "remove") {
              return my_gadget.editor_removeFile();
            }
          }
        }
        return my_parameter;
      }
      CodeMirror.menu_dict.editor_updateStorage = editor_updateStorage;
    })

    /////////////////////////////
    // published methods
    /////////////////////////////

    /////////////////////////////
    // acquired methods
    /////////////////////////////
    .declareAcquiredMethod('setActiveStorage', 'setActiveStorage')
    .declareAcquiredMethod('jio_create', 'jio_create')
    .declareAcquiredMethod('jio_allDocs', 'jio_allDocs')
    .declareAcquiredMethod('jio_allAttachments', 'jio_allAttachments')
    .declareAcquiredMethod('jio_putAttachment', 'jio_putAttachment')
    .declareAcquiredMethod('jio_removeAttachment', 'jio_removeAttachment')
    .declareAcquiredMethod('jio_getAttachment', 'jio_getAttachment')

    /////////////////////////////
    // declared methods
    /////////////////////////////
    .declareMethod('render', function (my_option_dict) {
      var gadget = this,
        dict = gadget.property_dict;

      return new RSVP.Queue()
        .push(function () {
          return gadget.dialog_setDialogExtension();
        })
        .push(function () {

          // sets editor on CodeMirror.menu_dict
          // http://codemirror.net/doc/manual.html#config
          dict.editor = CodeMirror.fromTextArea(dict.textarea, {
            readOnly: false,
            matchBrackets: true,
            autoCloseBrackets: false,
            showTrailingSpace: true,
            fullScreen: true,
            placeholder: PLACEHOLDER,
            keyMap: "my", // default "default"
            showCursorWhenSelecting: true,
            extraKeys: null,
            lineNumbers: true, // default false
            tabSize: 2, // default 4
            smartIndent: true, // default true
            indentWithTabs: false, // default false
            lint: false,
            gutters: ["CodeMirror-lint-markers"],
            myAutoLint: true,
            autofocus: true, // default false
            theme: "rubyblue", // default "default"
            mode: "text"
          });

          return gadget;
        });
    })
    
    .declareMethod('dialog_setFileMenu', function () {
      var gadget = this,
        props = CodeMirror.menu_dict, 
        memory_list = [],
        entry_dict = {};

      // build a list of folders and file ids stored on memory and serviceworker
      new RSVP.Queue()
        .push(function () {
          return CodeMirror.menu_dict.editor_getActiveFileList(gadget);
        })
        .push(function (my_memory_content) {
          var response,
            item,
            i;
  
          for (i = 0; i < my_memory_content.length; i += 1) {
            response = my_memory_content[i];
            for (item in response) {
              if (response.hasOwnProperty(item)) {
                memory_list.push(item);
              }
            }
          }
          return gadget.setActiveStorage("serviceworker");
        })
        .push(function () {
            return gadget.jio_allDocs();
        })
        .push(function (my_directory_list) {
          var response_dict = my_directory_list.data,
            directory_content_list = [],
            cache_id,
            i;
  
          if (my_directory_list !== undefined) {
  
            //entry_dict = {};
            if (response_dict.total_rows === 1) {
              props.editor_active_cache = response_dict.rows[0].id;
            }
            for (i = 0; i < response_dict.total_rows; i += 1) {
              cache_id = response_dict.rows[i].id;
              entry_dict[i] = {"name": cache_id, "item_list": []};
              directory_content_list.push(gadget.jio_allAttachments(cache_id));
            }
          }
          return RSVP.all(directory_content_list);
        })
        .push(function (my_directory_content) {
          var len = my_directory_content.length,
            response,
            item,
            i;
  
          // loop folder contents, exclude history and check if file is on memory
          if (len > 0) {
            for (i = 0; i < len; i += 1) {
              response = my_directory_content[i];
              for (item in response) {
                if (response.hasOwnProperty(item)) {
                  if (item.indexOf("_history") === -1) {
                    if (memory_list.indexOf(item) > -1) {
                      item = item + "*";
                    }
                    entry_dict[i].item_list.push(item);
                  }
                }
              }
            }
          }
          props.dialog.insertBefore(
            props.dialog_createFileMenu(entry_dict),
            props.dialog.querySelector('span')
          );
        });
    })  
    
    .declareMethod('editor_removeFile', function () {
      var gadget = this, 
        props = CodeMirror.menu_dict,
        dialog = props.dialog,
        active_cache,
        file_name;

      // REMOVE => clear file from memory and serviceworker

      // no file selected
      if (!props.editor_active_file) {
        return true;
      }

      active_cache = props.editor_active_cache || "textitor";
      file_name = props.editor_active_file.name;
      
      return new RSVP.Queue()
        .push(function () {
          return gadget.setActiveStorage("memory");
        })
        .push(function () {
          return gadget.jio_getAttachment(active_cache, file_name);
        })
        .push(
          function () {
            return RSVP.all([
              gadget.jio_removeAttachment(active_cache, file_name),
              gadget.jio_removeAttachment(active_cache, file_name + "_history")
            ]);
          }, 
          function (my_error) {
            if (is404(my_error)) {
              return;
            }
            throw my_error;
          }
        )
        .push(function () {
          return gadget.setActiveStorage("serviceworker");
        })
        .push(function () {
          return gadget.jio_removeAttachment(active_cache, file_name);
        })
        .push(function () {
          var new_doc = props.editor_createDoc(),
            // new_doc = CodeMirror.Doc(""), 
            old_doc = props.editor.swapDoc(new_doc);
          props.editor_resetActiveFile();
          props.editor_resetModified();
          return true;
        });
    })

    .declareMethod('editor_saveFile', function () {
      var gadget = this,
        props = CodeMirror.menu_dict,
        dialog = props.dialog,
        file_name_input,
        file_name,
        is_cache_name,
        content,
        active_cache,
        mime_type_input,
        mime_type;

      // SAVE => store on serviceworker, remove from memory

      if (!dialog || (!props.editor_active_dialog && !props.editor_active_file)) {
        CodeMirror.commands.myEditor_navigateHorizontal(props.editor, "right");
        return;
      }

      file_name_input = dialog.querySelector("input[type='text']");
      file_name = file_name_input.value;
      is_cache_name = dialog.querySelector('input:checked');
      content = props.editor.getValue();
      active_cache = props.editor_active_cache || "textitor";
      console.log("file_name", file_name)
      console.log("active file", props.editor_active_file)
      // validate URL
      if (!file_name || file_name === "Enter valid URL.") {
        return props.dialog_flagInput(file_name_input, 'Enter valid URL.');
      }

      // validate Cache (NOT SUPPORTED YET)
      if (!is_cache_name) {
        mime_type_input = file_name.split(".").pop().replace("/", "");
        mime_type = MODEMIMES[mime_type_input] ||
            MODEMIMES[SHIMMODEMIMES[mime_type_input]] ||
                "text/plain";
      } else {
        return props.dialog_flagInput(file_name_input, 'Cache not supported');
      }

      return new RSVP.Queue()
        .push(function () {
          return gadget.setActiveStorage("memory");
        })
        .push(function () {
          return gadget.jio_getAttachment(active_cache, file_name);
        })
        .push(
          function (my_file) {
            return RSVP.all([
              gadget.jio_removeAttachment(active_cache, file_name),
              gadget.jio_removeAttachment(active_cache, file_name + "_history")
            ]);
          },
          function (my_error) {
            if (is404(my_error)) {
              return;
            }
            throw my_error;
          }
        )
        .push(function() {
          return gadget.setActiveStorage("serviceworker");
        })
        .push(function() {
          return gadget.jio_putAttachment(
            active_cache,
            file_name,
            new Blob([content], {type: mime_type})
          );
        })
        .push(function () {
          props.editor.setOption("mode", mime_type);
          props.editor_setActiveFile(file_name, mime_type);
          props.editor_resetModified();
          return true;
        });
    })

    .declareMethod('editor_swapFile', function (my_content) {
      var gadget = this,
        props = CodeMirror.menu_dict,
        dialog = props.dialog,
        is_no_new_or_active_file = !props.editor_active_file && !my_content,
        is_no_file_name,
        file_name;

      // SWAP => put existing file on memory storage, replace with new content!

      if (is_no_new_or_active_file) {
        if (!dialog) {
          if (props.editor_is_modified) {
            CodeMirror.commands.myEditor_navigateHorizontal(props.editor, "right");
          }
          return;
        }
        if (props.editor_is_modified) {
          file_name = dialog.querySelector("input").value;
          is_no_file_name = file_name === "" || file_name === 'Enter valid URL.';
          if (is_no_file_name) {
            if (props.editor_active_dialog) {
              return true;
            }
            CodeMirror.commands.myEditor_navigateHorizontal(props.editor, "right");
            return;
          }
          return;
        }
      }
      console.log("starting swap")
      // what if file name is set but not saved => where do I get content?
      return new RSVP.Queue()
        .push(function () {
          return gadget.setActiveStorage("memory");
        })
        .push(function () {
          var new_doc = props.editor_createDoc(my_content),
            old_doc = props.editor.swapDoc(new_doc),
            active_storage = props.editor_active_cache || "textitor",
            active_file = props.editor_active_file,
            save_file_name,
            save_mime_type;
          console.log("already swapped doc, now setting active file to active...")
          console.log("current_active_file", active_file)
          // set active file to active and save previous file (old_doc)
          if (active_file && props.editor_is_modified) {
            save_file_name = props.editor_active_file.name,
            save_mime_type = props.editor_active_file.mime_type;

            return RSVP.all([
              gadget.jio_putAttachment(
                active_storage,
                save_file_name,
                new Blob([old_doc.getValue()], {type: save_mime_type})
              ),
              gadget.jio_putAttachment(
                active_storage,
                save_file_name + "_history",
                new Blob([JSON.stringify(old_doc.getHistory())], {
                  'type': "application/json"
                })
              )
            ]);
          }
        })
        .push(function () {
          console.log("why does this not work on swapping in an empty file")

          // if new file is "", active file must be cleared along with textinput
          // if new file is with content, active file must be set along with textinput
          console.log("my_content should be undefined", my_content)
          if (!my_content) {
            console.log("NO CONTENT, clearing active and resetting modified")
            props.dialog_clearTextInput(dialog);
            props.editor_resetActiveFile();
            props.editor_resetModified();
          } else {
            console.log("we opened a file, content was ", my_content)
            
          }
          console.log("text input should be cleared")
          console.log("active file should be null", props.editor_active_file)
          return true;
        });
    })

    .declareMethod('editor_openFile', function () {
      var gadget = this,
        props = CodeMirror.menu_dict,
        dialog = props.dialog,
        file_name_input = dialog.querySelector('input:checked'),
        file_name,
        open_name,
        active_cache,
        mime_type,
        xxx;

      // open = get from memory/serviceworker, close and store any open file!   
      if (file_name_input === null) {
        return true;
      }

      active_cache = props.editor_active_cache || "textitor";
      file_name = file_name_input.nextSibling.textContent.split(" | ")[1];

      // show "save" hint when a file has not been saved
      if (file_name.indexOf("*") > 0) {
        props.editor_setModified();
        xxx = true;
      }

      open_name = file_name.split("*")[0];

      // try to fetch from memory
      return new RSVP.Queue()
        .push(function () {
          return gadget.setActiveStorage("memory");
        })
        .push(function () {
          return RSVP.all([
            gadget.jio_getAttachment(active_cache, open_name),
            gadget.jio_getAttachment(active_cache, open_name + "_history")
          ]);
        })
        .push(null, function (my_error) {

          // fetch from serviceworker with blank history - serviceworker saved
          // files have no history.
          if (is404(my_error)) {
            return new RSVP.Queue()
              .push(function () {
                return gadget.setActiveStorage("serviceworker");
              })
              .push(function () {
                return RSVP.all([
                  gadget.jio_getAttachment(active_cache, open_name),
                  new Blob([])
                ]);
              });
          }
          throw my_error;
        })
        .push(function (my_response_list) {
          mime_type = my_response_list[0].type;
          return RSVP.all([
            jIO.util.readBlobAsText(my_response_list[0]),
            jIO.util.readBlobAsText(my_response_list[1])
          ]);
        })
        .push(function (my_content) {
          return gadget.editor_swapFile(my_content);
        })
        .push(function () {
          console.log("done opening")
          props.editor.setOption("mode", mime_type);
          props.editor_setActiveFile(open_name, mime_type);
          if (xxx === undefined) {
            props.editor_resetModified();
          }
          return true;
        });
    })

    .declareMethod('dialog_setDialogExtension', function () {
      var gadget = this;

      function dialogCallback(my_template, my_callback, my_option_dict) {
        var queue = new RSVP.Queue(),
          props = CodeMirror.menu_dict,
          editor = props.editor,
          opts = my_option_dict || {},
          dialog_event_list = [],
          dialog_form_submit_list = [],
          dialog_input,
          dialog;

        dialog = props.dialog = props.editor_setDialog(editor, my_template, opts.bottom);
        dialog_input = dialog.querySelector("input[type='text']");
        props.editor_active_dialog = true;
        closeNotification(props.editor, null);

        function wrapBind(my_element, my_event_name, my_property_name) {
          return loopEventListener(my_element, my_event_name, false, function (my_event) {
            return opts[my_property_name](my_event, dialog_input.value, props.dialog_evaluateState);
          });
        }

        if (dialog_input) {
          
          // focus to enable up/down shortcuts
          //if (props.dialog_position === 'left') {
            dialog_input.focus();
          //}
          if (props.dialog_position === 'right') {
            console.log("setting input", opts.value, props.editor_getActiveFile()[0])
            dialog_input.value = opts.value || props.editor_getActiveFile()[0];
          }
          if (opts.selectValueOnOpen !== false) {
            dialog_input.select();
          }
          if (opts.onInput) {
            dialog_event_list.push(wrapBind(dialog_input, "input", "onInput"));
          }
          if (opts.closeOnBlur !== false && opts.onBlur) {
            dialog_event_list.push(wrapBind(dialog, "blur", "onBlur"));
          }
        }
        if (opts.onKeyUp) {
          dialog_event_list.push(wrapBind(dialog, "keyup", "onKeyUp"));
        }
        if (opts.onKeyDown) {
          dialog_event_list.push(wrapBind(dialog, "keydown", "onKeyDown"));
        }

        // form submits
        dialog_form_submit_list = Array.prototype.slice.call(
          dialog.querySelectorAll('form')
        ).map(function(my_element) {
          return wrapBind(my_element, "submit", "onSubmit");
        });

        // file menu
        if (props.dialog_position === 'left') {
          queue.push(gadget.dialog_setFileMenu());
        }

        
        // XXX always close dialog via this chain, resolve all promises?
        return queue
          .push(function () {
            return RSVP.all([
              RSVP.all(dialog_event_list),
              RSVP.any(dialog_form_submit_list)
            ]);
          })
          .push(function () {
            return props.dialog_evaluateState(false);
          })
          .push(undefined, function (my_error) {
            throw my_error;
          });
      }

      return CodeMirror.defineExtension("openDialog", dialogCallback);
    })

    /////////////////////////////
    // declared service
    /////////////////////////////
    .declareService(function () {
      var gadget = this,
        props = gadget.property_dict,
        editor = props.editor;

      editor.refresh();
      editor.focus();

      return codeMirrorLoopEventListener(editor, 'change', function () {
        return props.editor_setModified();
      });
    })
    
    .declareService(function () {
      var gadget = this,
        props = gadget.property_dict,
        message = "Don't forget to save your work!",
        result;
        
      // warn of unsaved files or content
      return new RSVP.Queue()
        .push(function () {
          return promiseEventListener(window, "beforeunload", true);
        })
        .push(function (my_event) {
          my_event = my_event || window.event;
          
          return new RSVP.Queue()
            .push(function () {
              return CodeMirror.menu_dict.editor_getActiveFileList(gadget);  
            })
            .push(function (my_memory_content) {
              if (my_memory_content.length > 0 || props.editor_is_modified) {
                if (my_event) {
                  my_event.returnValue = message;
                }
                return message;
              }
            });        
        });
    });

}(window, document, rJS, CodeMirror, JSON, loopEventListener));

