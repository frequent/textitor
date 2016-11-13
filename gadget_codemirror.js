/*jslint indent: 2, vars: true, nomen: true, maxerr: 3 */
/*global window, document, rJS, CodeMirror, JSON, loopEventListener */

(function (window, document, rJS, CodeMirror, JSON, loopEventListener) {
  "use strict";

  /////////////////////////////
  // Vocabulary
  /////////////////////////////
  var LEFT = "left";
  var RIGHT = "right";
  var UP = "up";
  var DOWN = "down";
  var SAVE = "save";
  var CLOSE = "close";
  var OPEN = "open";
  var REMOVE = "remove";
  var SEARCH = "search";
  var BULK = "bulk";
  
  // and...
  var IDLE = "idle";

  /////////////////////////////
  // Placeholder Instructions
  /////////////////////////////
  var PLACEHOLDER = "Textitor Shortcuts:\n" +
    "[CTRL+ALT+o]     Open Selected File\n" +
    "[CTRL+ALT+s]     Save Current/All Selected File(s)\n" +
    "[CTRL+ALT+f]     Filter Filenames\n" +
    "[CTRL+ALT+up]    Filemenu Up\n" +
    "[CTRL+ALT+down]  Filemenu Down\n" +
    "[CTRL+ALT+left]  Folder Up\n" +
    "[CTRL+ALT+right] Folder Down/File\n" +
    "[CTRL+ALT+x]     Close Dialog\n" +
    "[CTRL+ALT+c]     Close File\n" +
    "[CTRL+ALT+d]     Delete File\n" +
    "[Esc]            Close Dialog\n";

  /////////////////////////////
  // Supported Languages
  /////////////////////////////
  var MIMES = {
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

  var SHIMMIMES = {
    "html": "htmlmixed",
    "js": "javascript",
    "py": "python",
    "md": "markdown"
  };

  /////////////////////////////
  // Templates
  /////////////////////////////
  var BLANK_SEARCH = {"target": {'name': SEARCH,  'find': {'value': ''}}};

  var FILE_NAME_TEMPLATE = "<div class='custom-file-name'>%s</div>";

  var FILE_MENU_TEMPLATE = "<div class='custom-file-menu'>%s</div>";

  var FILE_ENTRY_TEMPLATE = "<div class='custom-file-menu-row'>" +
      "<input type='checkbox' autocomplete='off' />" +
      "<span class='custom-file-menu-checkbox-overlay'>%s</span>" +
      "</div>";

  var OBJECT_MENU_TEMPLATE = "<span class='custom-menu-label'>Name:</span>" +
    "<input type='text' tabindex='1' placeholder='file name' value='%s' />" +
    "<input type='hidden' value='%s' />" +
    "<span class='custom-menu-label'>Cache</span>" +
    "<input type='radio' tabindex='2' name='is_container' value='cache' />" +
    "<span class='custom-menu-label'>Folder</span>" +
    "<input type='radio' tabindex='3' name='is_container' value='folder' />" +
    "<span class='custom-menu-typewriter'>CTRL+ALT+</span>" +
    "<form name='save'>" +
      "<button type='submit' tabindex='4' class='custom-menu-button'>" +
        "<b>S</b>ave</button></form>" +
    "<form name='close'>" +
      "<button type='submit' tabindex='5' class='custom-menu-button'>" +
        "<b>C</b>lose</button></form>" +
    "<form name='remove'>" +
      "<button type='submit' tabindex='6' class='custom-menu-button'>" +
        "<b>D</b>elete</button></form>";

  var OBJECT_LIST_TEMPLATE = "<span>Search:</span>" +
    "<form name='search' autocomplete='off'>" +
      "<input type='text' tabindex='1' name='find' placeholder='search...' />" +
      "<span class='custom-menu-typewriter'>CTRL+ALT+</span>" +
      "<button type='submit' tabindex='2' class='custom-menu-button'>" +
        "<b>F</b>ind</button></form>" +
    "<form name='bulk'>" +
      "<button type='submit' tabindex='3' class='custom-menu-button'>" +
        "<b>S</b>ave All</button></form>";

  /////////////////////////////
  // Event handling (gadget_global.js)
  /////////////////////////////
  function promiseEventListener(target, type, useCapture) {
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

  // CUSTOM loopEventListener for CodeMirror events (not using DOM)
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
  CodeMirror.menu_dict.editor_active_path = null;
  CodeMirror.menu_dict.editor_active_file = null;
  CodeMirror.menu_dict.editor_active_cache = null;
  CodeMirror.menu_dict.editor_is_modified = null;
  CodeMirror.menu_dict.dialog = null;
  CodeMirror.menu_dict.dialog_position = IDLE;
  CodeMirror.menu_dict.dialog_option_dict = {
    "position": 'top',
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

  function editor_setActivePath(my_folder_path) {
    CodeMirror.menu_dict.editor_active_path = my_folder_path;
  }
  
  function editor_setDialog(my_editor, my_template, my_position) {
    var wrap = my_editor.getWrapperElement(),
      selector = ".CodeMirror-dialog.CodeMirror-dialog-" + my_position,
      element = wrap.querySelector(selector),
      container =  element || wrap.appendChild(document.createElement("div"));

    container.className = selector.split(".").join(" ");  

    if (typeof my_template == "string") {
      container.innerHTML = my_template;
    } else {
      container.appendChild(my_template);
    }
    
    if (!element) {
      if (my_position === "bottom") {
        wrap.appendChild(container);
      } else {
        wrap.insertBefore(container, wrap.firstElementChild);
      }
    }
    return container;
  }

  function editor_setModified(source) {
    var props = CodeMirror.menu_dict;
    if (props.editor_is_modified !== true) {
      props.editor_is_modified = true;
      props.element.querySelector(".CodeMirror").className += " custom-set-modified";
    }
  }

  function editor_setDisplay(my_file_name) {
    var props = CodeMirror.menu_dict;
    if (props.display) {
      props.display.parentNode.removeChild(props.display);
      props.display = null;
    }
    if (!my_file_name) {
      return;
    }
    props.display = props.editor_setDialog(
      props.editor,
      props.dialog_parseTemplate(FILE_NAME_TEMPLATE, [my_file_name]),
      'bottom'
    );
    return;
  }

  function editor_resetModified() {
    var props = CodeMirror.menu_dict,
      element = props.element.querySelector(".CodeMirror");

    props.editor_is_modified = null;
    element.className = element.className.split("custom-set-modified").join("");
  }

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
        return promiseEventListener(my_input, 'focus', false);
      })
      .push(function () {
        my_input.className = '';
        my_input.value = '';
        return false;
      });
  }

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
    var href = window.location.href,
      str = "",
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
            [folder.name + " | " + folder.item_list[i].replace(href, "")]
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
      if (my_direction === DOWN) {
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
    for (i = 0, len = input_list.length; i < len; i += 1) {
      if (input_list[i].type === 'text') {
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
        if (my_close_dialog === true && props.editor_active_dialog) {
          if (props.dialog_option_dict.onClose) {
            props.dialog_option_dict.onClose(dialog);
          }
          props.dialog.parentNode.removeChild(props.dialog);
          props.editor_active_dialog = null;
          props.editor.focus();
          props.dialog_position = IDLE;
        }
      })
      .push(null, function (error) {
        console.log(error);
        throw error;
      });
  }

  function dialog_isFileMenuItem(my_path, my_folder) {
    var folder = my_folder || "/",
      path = my_path.split(window.location.href).pop(),
      indexFolder = path.indexOf(folder),
      splitFolder = path.split(folder),
      splitFolderPop;

    console.log("IN, ", folder, my_path, indexFolder, splitFolder)

    // self
    if (path === folder) {
      console.log("self, FALSE")
      return false;
    }

    // parent folder/file
    if ((indexFolder === -1) && folder !== "/") {
      console.log("parent folder/file, FALSE")
      return false;
    }
    
    // inside subfolder
    if (indexFolder > -1) {

      // current active folder, ok
      if (splitFolder[0] === "" && splitFolder[1].split("/").length === 2) {
        console.log("subfolder, but currently on it, TRUE")
        return true;
      }
      console.log("subfolder, FALSE")
      return false;
    }

    // direct child file/folder
    splitFolderPop = splitFolder.pop();
    if (splitFolderPop.split(".").length !== 2) {
      if (splitFolderPop.split("/").length === 1) {
        console.log("sub-file, TRUE")
        return true;
      }
      console.log("sub-folder, path, FALSE")
      return false;
    }                  
    console.log("nothing, TRUE")
    return true;              
  }

  function dialog_setNavigationMenu(my_direction) {
    switch (CodeMirror.menu_dict.dialog_position) {
      case IDLE:
        CodeMirror.menu_dict.dialog_position = my_direction;
        if (my_direction === RIGHT) {
          return CodeMirror.menu_dict.dialog_parseTemplate(
            OBJECT_MENU_TEMPLATE,
            CodeMirror.menu_dict.editor_getActiveFile()
          );
        }
        return OBJECT_LIST_TEMPLATE;
      case LEFT:
        if (my_direction === LEFT) {
          return OBJECT_LIST_TEMPLATE;
        }
        CodeMirror.menu_dict.dialog_position = IDLE;
        return;
      case RIGHT:
        if (my_direction === LEFT) {
          CodeMirror.menu_dict.dialog_position = IDLE;
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
      return CodeMirror.commands.myEditor_navigateVertical(undefined, UP);
    }
    if (my_event.keyCode === 36) {
      return CodeMirror.commands.myEditor_navigateVertical(undefined, DOWN);
    }

    if (my_event.type === "input") {
      return my_callback(my_value);
    }

    // ctrl + alt +
    if (my_event.ctrlKey && my_event.altKey) {
      switch(my_event.keyCode) {
        case 68: return CodeMirror.commands.myEditor_deleteFile();
        case 67: return CodeMirror.commands.myEditor_closeFile();
        case 70: return CodeMirror.commands.myEditor_searchFileMenu();
        case 79: return CodeMirror.commands.myEditor_openFromDialog();
        case 83: return CodeMirror.commands.myEditor_saveFromDialog(CodeMirror);
        case 88: return CodeMirror.commands.myEditor_closeDialog();

        // NOTE: we could pass CodeMirror.menu_dict.editor;
        case 37: return CodeMirror.commands.myEditor_navigateHorizontal(undefined, LEFT);
        case 39: return CodeMirror.commands.myEditor_navigateHorizontal(undefined, RIGHT);
        case 38: return CodeMirror.commands.myEditor_navigateVertical(undefined, UP);
        case 40: return CodeMirror.commands.myEditor_navigateVertical(undefined, DOWN);
      }
    }
  }

  CodeMirror.menu_dict.editor_createDoc = editor_createDoc;
  CodeMirror.menu_dict.editor_setDialog = editor_setDialog;
  CodeMirror.menu_dict.editor_setModified = editor_setModified;
  CodeMirror.menu_dict.editor_setDisplay = editor_setDisplay;
  CodeMirror.menu_dict.editor_setActivePath = editor_setActivePath;
  CodeMirror.menu_dict.editor_resetModified = editor_resetModified;
  CodeMirror.menu_dict.editor_resetActiveFile = editor_resetActiveFile;
  CodeMirror.menu_dict.editor_setActiveFile = editor_setActiveFile;
  CodeMirror.menu_dict.editor_getActiveFile = editor_getActiveFile;
  CodeMirror.menu_dict.editor_getActiveFileList = editor_getActiveFileList;
  CodeMirror.menu_dict.dialog_isFileMenuItem = dialog_isFileMenuItem;
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
  CodeMirror.keyMap.my["Ctrl-Alt-F"] = "myEditor_searchFileMenu";
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
      return CodeMirror.menu_dict.dialog_evaluateState({"target":{"name": CLOSE}});
    }
  }

  function editor_deleteFile() {
    if (CodeMirror.menu_dict.dialog_evaluateState) {
      return CodeMirror.menu_dict.dialog_evaluateState({"target": {"name": REMOVE}});
    }
  }

  function editor_searchFileMenu() {
    var props = CodeMirror.menu_dict,
      input;
    if (props.dialog_evaluateState && props.dialog && props.dialog_position === LEFT) {
      input = props.dialog.querySelector("input[type='text']");
      if (input) {
        return props.dialog_evaluateState({
          "target": {'name': SEARCH, 'find': {'value': input.value}}
        });
      }
    }
    return;
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

  function editor_saveFromDialog(my_codemirror) {
    if (CodeMirror.menu_dict.dialog_position !== LEFT) {
      if (CodeMirror.menu_dict.dialog_evaluateState) {
        return CodeMirror.menu_dict.dialog_evaluateState({"target":{"name": SAVE}});
      } else {
        return CodeMirror.commands.myEditor_openDialog(CodeMirror, RIGHT);
      }
    } else {
      CodeMirror.commands.myEditor_bulkSaveFromDialog();
    }
  }

  function editor_openFromDialog() {
    if (CodeMirror.menu_dict.dialog_position === LEFT) {
      return CodeMirror.menu_dict.dialog_evaluateState({"target":{"name": OPEN}});
    }
  }

  function editor_bulkSaveFromDialog() {
    if (CodeMirror.menu_dict.dialog_position === LEFT) {
      return CodeMirror.menu_dict.dialog_evaluateState({"target":{"name": BULK}});
    }
  }

  function editor_navigateHorizontal(my_codemirror, my_direction) {
    var props = CodeMirror.menu_dict,
      position = props.dialog_position,
      parameter,
      path_list;

    if (position === IDLE) {
      return CodeMirror.commands.myEditor_openDialog(my_codemirror, my_direction);
    }
    if (position === my_direction) {
      if (position === LEFT && props.editor_active_path) {
        if (props.editor_active_dialog) {
          path_list = props.editor_active_path.split("/");
          path_list = path_list.splice(0, path_list.length - 1).join("/");
          props.editor_active_path = path_list || null;
          props.editor_setDisplay(props.editor.active_path);
        }
        parameter = BLANK_SEARCH;
      } else {
        parameter = false;
      }
    }
    if (position === RIGHT && my_direction == LEFT) {
      parameter = true;
    }
    if (position === LEFT && my_direction === RIGHT) {
      parameter = {"target": {"name": OPEN}};
    }
    return props.dialog_evaluateState(parameter);
  }

  function editor_navigateVertical(my_codemirror, my_direction) {
    return CodeMirror.menu_dict.dialog_updateFileMenu(my_direction);
  }

  function editor_navigateRight(cm) {
    return CodeMirror.commands.myEditor_navigateHorizontal(cm, RIGHT);
  }

  function editor_navigateLeft(cm) {
    return CodeMirror.commands.myEditor_navigateHorizontal(cm, LEFT);
  }

  function editor_navigateUp(cm) {
    return CodeMirror.commands.myEditor_navigateVertical(cm, UP);
  }

  function editor_navigateDown(cm) {
    return CodeMirror.commands.myEditor_navigateVertical(cm, DOWN);
  }

  CodeMirror.commands.myEditor_closeFile = editor_closeFile;
  CodeMirror.commands.myEditor_deleteFile = editor_deleteFile;
  CodeMirror.commands.myEditor_searchFileMenu = editor_searchFileMenu;
  CodeMirror.commands.myEditor_closeDialog = editor_closeDialog;
  CodeMirror.commands.myEditor_openDialog = editor_openDialog;
  CodeMirror.commands.myEditor_saveFromDialog = editor_saveFromDialog;
  CodeMirror.commands.myEditor_bulkSaveFromDialog = editor_bulkSaveFromDialog;
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
      function editor_updateStorage(my_pointer) {
        var action;
        if (my_pointer) {
          if (my_pointer.target) {
            action = my_pointer.target.name;
            if (action === BULK) {
              return my_gadget.editor_bulkSave();
            }
            if (action === SEARCH) {
              return my_gadget.dialog_setFileMenu(my_pointer.target.find.value);
            }
            if (action === OPEN) {
              return my_gadget.editor_openFile();
            }
            if (action === CLOSE) {
              return my_gadget.editor_swapFile();
            }
            if (action === SAVE) {
              return my_gadget.editor_saveFile();
            }
            if (action === REMOVE) {
              return my_gadget.editor_removeFile();
            }
          }
        }
        return my_pointer;
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

    .declareMethod('dialog_setFileMenu', function (my_search_value) {
      var gadget = this,
        props = CodeMirror.menu_dict,
        memory_list = [],
        entry_dict = {},
        option_dict;

      return new RSVP.Queue()
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
          var editor = props.dialog.parentNode,
            file_menu = editor.querySelector(".custom-file-menu"),
            len = my_directory_content.length,
            current_folder = props.editor_active_path || "",
            path,
            is_nested,
            response,
            item,
            i;

          // loop folder contents, exclude history, check if file is on memory
          // and match against search (can't user query on allAttachments)
          // if no search is run, indexOf("") = 0 & account for folders/cache
          // by filtering ids for them until keeping a file index in the folder
          if (len > 0) {
            for (i = 0; i < len; i += 1) {
              response = my_directory_content[i];
              for (item in response) {
                if (response.hasOwnProperty(item)) {
                  if (props.dialog_isFileMenuItem(item, current_folder)) {  
                    console.log("put on menu", item)
                    if (item.indexOf("_history") === -1) {
                      if (memory_list.indexOf(path) > -1) {
                        item = item + "*";
                      }
                      if (item.indexOf(my_search_value || "") > -1) {
                        entry_dict[i].item_list.push(item);
                      }
                    }
                  }
                }
              }
            }
          }

          if (file_menu) {
            file_menu.parentNode.replaceChild(
              props.dialog_createFileMenu(entry_dict),
              file_menu
            );
          } else {
            props.dialog.insertBefore(
              props.dialog_createFileMenu(entry_dict),
              props.dialog.querySelector('span')
            );
          }
        })
        .push(null, function (my_error) {
          console.log(my_error);
          throw my_error;
        });
    })  

    .declareMethod('editor_removeFile', function () {
      var gadget = this, 
        props = CodeMirror.menu_dict,
        dialog = props.dialog,
        active_cache,
        file_name;

      // REMOVE => clear file from memory and serviceworker

      console.log("what up Remove?")
      console.log(props.editor_active_file)
      console.log(props.editor_active_path)

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
            old_doc = props.editor.swapDoc(new_doc);
          props.editor_resetActiveFile();
          props.editor_resetModified();
          props.editor_setDisplay();
          return true;
        });
    })

    .declareMethod('editor_bulkSave', function () {
      var gadget = this,
        props = CodeMirror.menu_dict,
        folder_list = [];

      function bulkHandle(my_folder_content) {
        var file_list = [],
          file_url;
        for (file_url in my_folder_content) {
          if (my_folder_content.hasOwnProperty(file_url)) {
            if (file_url.indexOf('_history') === -1) {
              file_list.push(gadget.editor_saveFile(file_url));
            }
          }
        }
        return RSVP.all(file_list);
      }

      return new RSVP.Queue()
        .push(function () {
          return CodeMirror.menu_dict.editor_getActiveFileList(gadget);  
        })
        .push(function (my_cache_list) {
          var i,
            len;
          for (i = 0, len = my_cache_list.length; i < len; i += 1) {
            folder_list.push(bulkHandle(my_cache_list[i]));
          }
          return RSVP.all(folder_list);
        })
        .push(function () {
          return CodeMirror.commands.myEditor_searchFileMenu();
        });
    })

    .declareMethod('editor_saveFile', function (my_file_id) {
      var gadget = this,
        props = CodeMirror.menu_dict,
        dialog = props.dialog,
        active_cache = props.editor_active_cache || "textitor",
        file_name_input,
        file_name,
        is_container,
        content,
        folder_file_list,
        mime_type_input,
        mime_type;

      // SAVE => store on serviceworker, remove from memory

      function setMimeType(my_mime) {
        return MIMES[my_mime] || MIMES[SHIMMIMES[my_mime]] || "text/plain";
      }

      // bulkSave will pass file_id, file will not be open, need to get content
      
      // XXX refactor
      if (!my_file_id) {
        console.log("no filen_id passed -> base safe")
        if (!dialog || (!props.editor_active_dialog && !props.editor_active_file)) {
          console.log("no dialog, force and end")
          CodeMirror.commands.myEditor_navigateHorizontal(props.editor, RIGHT);
          return;
        }
        if (!props.editor_active_file) {
          console.log("active file")
          file_name_input = dialog.querySelector("input");
          file_name = file_name_input.value;
          is_container = dialog.querySelector('input[name="is_container"]:checked');
          mime_type_input = file_name.split(".").pop().replace("/", "");
          mime_type = setMimeType(mime_type_input);
        } else {
          console.log("no active file")
          file_name = props.editor_active_file.name;
          mime_type = props.editor_active_file.mime_type;
        }

        // validate form
        if (dialog) {
          console.log("dialog set")
          if (!file_name || file_name_input && file_name_input.value === "Enter valid URL.") {
            console.log("dialog set missing file name")
            return props.dialog_flagInput(file_name_input, 'Enter valid URL.');
          }
        }
        content = props.editor.getValue();
        
        if (is_container) {
          console.log("creating a folder")
          if (is_container.value === 'cache') {
            return props.dialog_flagInput(file_name_input, 'Cache not supported');
          }
          if (props.editor_active_path) {
            file_name = props.editor_active_path + "/" + file_name;
          }
          mime_type = "application/json";
          folder_file_list = [];
        }
      } else {
        console.log("file_id passed, bulk save?")
        file_name = my_file_id;
        mime_type = setMimeType(file_name.split(".").pop().replace("/", ""));
      }

      // XXX fix double trigger
      //file_name_input = dialog.querySelector("input");
      //if (file_name_input.value === "Enter valid URL.") {
      //  file_name_input.focus();
      //  return;
      //}

      if (props.editor_active_path) {
        console.log("prefixing with active path")
        file_name = props.editor_active_path + "/" + file_name
      }

      console.log("SAVING")
      console.log(file_name)
      console.log(content)
      return new RSVP.Queue()
        .push(function () {
          return gadget.setActiveStorage("memory");
        })
        .push(function () {
          return gadget.jio_getAttachment(active_cache, file_name);
        })
        .push(
          function (my_file) {
            var task_list = [];
            if (!content) {
              task_list.push(jIO.util.readBlobAsText(my_file));
            }
            task_list.push(gadget.jio_removeAttachment(active_cache, file_name));
            task_list.push(gadget.jio_removeAttachment(active_cache, file_name + "_history"));
            return RSVP.all(task_list);
          },
          function (my_error) {
            if (is404(my_error)) {
              return;
            }
            throw my_error;
          }
        )
        .push(function(my_content) {
          content = content || folder_file_list || my_content[0].target.result;
          console.log("storing on service worker")
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
          console.log("DONE")
          
          if (!my_file_id) {
            console.log("no file id, regualr save, file or folder, update everything")
            props.editor_resetModified();
            props.editor_setDisplay(file_name);
            if (is_container) {
              console.log("CONTAINER, end here")
              return true;
            }
            props.editor.setOption("mode", mime_type);
            props.editor_setActiveFile(file_name, mime_type);
            return true;
          }
          return false;
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
            CodeMirror.commands.myEditor_navigateHorizontal(props.editor, RIGHT);
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
            CodeMirror.commands.myEditor_navigateHorizontal(props.editor, RIGHT);
            return;
          }
          return;
        }
      }

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
          if (!my_content) {
            props.dialog_clearTextInput(dialog);
            props.editor_resetActiveFile();
            props.editor_resetModified();
            props.editor_setDisplay();
          }
          return true;
        });
    })

    .declareMethod('editor_openFile', function () {
      var gadget = this,
        props = CodeMirror.menu_dict,
        dialog = props.dialog,
        file_name_input = dialog.querySelector('input:checked'),
        file_name_to_open,
        open_name,
        active_cache,
        mime_type,
        file_name_to_open_save_flag;

      // open = get from memory/serviceworker, close and store any open file!
      
      if (file_name_input === null) {
        return true;
      }

      active_cache = props.editor_active_cache || "textitor";
      file_name_to_open = file_name_input.nextSibling.textContent.split(" | ")[1];

      // folder, add path and update panel
      if (file_name_to_open.split(".").length === 1) {
        props.editor_setActivePath(file_name_to_open);
        props.dialog_evaluateState(BLANK_SEARCH);
        props.editor_setDisplay(file_name_to_open + "/");
        return;
      }
      
      // flag save if new file comes from memory
      if (file_name_to_open.indexOf("*") > -1) {
        file_name_to_open_save_flag = true;
      }

      open_name = file_name_to_open.split("*")[0];

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
          props.editor.setOption("mode", mime_type);
          props.editor_setActiveFile(open_name, mime_type);
          props.editor_setDisplay(open_name);

          if (file_name_to_open_save_flag) {
            props.editor_setModified();
          } else {
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

        dialog = props.dialog = props.editor_setDialog(editor, my_template, opts.position);
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

        // file menu
        if (props.dialog_position === 'left') {
          queue.push(gadget.dialog_setFileMenu(dialog_input.value));
        }

        // form submits
        dialog_form_submit_list = Array.prototype.slice.call(
          dialog.querySelectorAll('form')
        ).map(function(my_element) {
          return wrapBind(my_element, "submit", "onSubmit");
        });

        return queue
          .push(function () {
            return RSVP.all([
              RSVP.all(dialog_event_list),
              RSVP.any(dialog_form_submit_list)
            ]);
          })
          .push(function () {
            return props.dialog_evaluateState(false);
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
        return props.editor_setModified("change listener");
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

