/*jslint indent: 2, vars: true, nomen: true, maxerr: 3 */
/*global window, rJS, document, location, alert, prompt, confirm, setTimeout,
  toolbox, CodeMirror, loopEventListener */

  /*
  ["Ctrl-Alt-0"] Open
  ["Ctrl-Alt-Up"] Up in current folder
  ["Ctrl-Alt-Down"] Down in current folder
  ["Ctrl-Alt-Right"] Up one folder/Close file
  ["Ctrl-Alt-Left"] Down one folder/Open file
  ["Ctrl-Alt-S"] Save File (*)
  ["Ctrl-Alt-X"] Close File
  ["Ctrl-Alt-D"] Delete File
  ["Ctrl-Alt-H"] List of Shortcuts
  */
 
  /////////////////////////////
  // templates
  /////////////////////////////
  var FILE_MENU_TEMPLATE = "<div class='custom-file-menu'>%s</div>";

  var FILE_ENTRY_TEMPLATE = "<div class='custom-file-menu-row'>" +
      "<input type='checkbox' autocomplete='off' />" +
      "<span class='custom-file-menu-checkbox-overlay'>%s</span>" +
      "</div>";
  
  var OBJECT_MENU_TEMPLATE = "<span>Name:</span><input type=\"text\" />" +
    "<span class='custom-menu-typewriter'>CTRL+ALT+</span>" +
    "<form name='save'><button type='submit' class='custom-menu-button'>" +
    "<b>S</b>ave</button></form>" +
    "<form name='close'><button type='submit' class='custom-menu-button'>" +
    "<b>C</b>lose</button></form>" +
    "<form name='remove'><button type='submit' class='custom-menu-button'>" + 
    "<b>D</b>elete</button></form>";
  
  var OBJECT_LIST_TEMPLATE = "<span>Search:</span><input type=\"text\" />" +
    "<span class='custom-menu-typewriter'>CTRL+ALT+</span>" +
    "<form name='search'><button type='submit' class='custom-menu-button'>" +
    "<b>F</b>ind</button></form>";

  /////////////////////////////
  // CodeMirror "Globals"
  /////////////////////////////
  CodeMirror.keyMap.my = {"fallthrough": "default"};
  CodeMirror.navigationMenu = {"position": "idle"};

  /////////////////////////////
  // dependency scripts
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
  
  /////////////////////////////
  // template rendering
  /////////////////////////////
  function parseTemplate(my_template, my_value_list) {
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

  // create file menu html
  function setFileMenu(my_file_dict) {
    var str,
      div,
      i,
      len,
      folder,
      counter;

    for (counter in my_file_dict) {
      if (my_file_dict.hasOwnProperty(counter)) {
        folder = my_file_dict[counter];
        for (i = 0, len = folder.item_list.length; i < len; i += 1) {
          str = parseTemplate(
            FILE_ENTRY_TEMPLATE,
            [folder.name + " | " + folder.item_list[i]]
          );
        }
      }
    }
    // XXX: hm...
    str = parseTemplate(FILE_MENU_TEMPLATE, [str]);
    div = document.createElement("div");
    div.innerHTML = str;
    return div.firstChild;
  }

    
  // create dialog html
  function setDialog(my_context, my_template, my_bottom) {
    var wrap = my_context.getWrapperElement(),
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

  // required by CodeMirror
  function closeNotification(my_context, my_newVal) {
    if (my_context.state.currentNotificationClose) {
      my_context.state.currentNotificationClose();
    }
    my_context.state.currentNotificationClose = my_newVal;
  }

  /////////////////////////////
  // form handling
  /////////////////////////////
  function dialog_updateStorage(my_gadget, my_dialog, my_event) {
    console.log("inside form submit callback");
    console.log(my_event);
    console.log(my_event.target);
    console.log(my_gadget);
    console.log(my_is_submit_event);
    // XXX resolve promise chain! not just close
    CodeMirror.navigationMenu.evaluateState();
  }
  
  function setFormSubmitListeners(my_dialog, my_gadget) {
    var form_list = my_dialog.querySelectorAll('form'),
      event_list = [],
      len,
      i;
    
    function dialog_setFormSubmitHandler(my_form) {
      return new RSVP.Queue()
        .push(function () {
          return promiseEventListener(my_form, "submit", false);
        })
        .push(function (my_event) {
          return dialog_updateStorage(my_gadget, my_form.parentNode, my_event);
        });
    }
    
    for (i = 0, len = form_list.length; i < len; i += 1) {
      event_list.push(dialog_setFormSubmitHandler(form_list[i]));
    }
    return event_list;
  }
  
  function dialog_getTextInput(my_dialog) {
    var input_list = my_dialog.querySelectorAll("input"),
      input,
      len,
      i;
    for (i = 0, len = input_list.length; i < len; i += 1) {
      if (input_list[i].type === 'text') {
        return input_list[i];
      }
    }
  }
  
  /////////////////////////////
  // dialog extension
  /////////////////////////////
  function dialog_setDialogExtension(my_gadget) {
    return CodeMirror.defineExtension(
      "openDialog",
      function(my_template, my_callback, my_option_dict) {
        var closing_event_list = [],
          storage_interaction_list = [],
          event_list = [],
          entry_dict,
          dialog,
          closed,
          text_input,
          text_input_value,
          button,
          my_context;

        my_context = my_context || this;
        my_option_dict = my_option_dict || {};
        dialog = setDialog(my_context, my_template, my_option_dict.bottom);
        closed = false;
        
        function dialog_evaluateState(my_parameter) {      
          return new RSVP.Queue()
            .push(function () {
              if (typeof my_newVal == 'string') {
                text_input.value = my_parameter;
              }
              if (closed === true) {
                return dialog_updateStorage(my_gadget, dialog);
              }
              return false;
            })
            .push(function (my_close_dialog) {
              if (my_close_dialog === true) {
                closed = true;
                dialog.parentNode.removeChild(dialog);
                my_context.focus();
                CodeMirror.navigationMenu.position = "idle";
        
                if (my_option_dict.onClose) {
                  my_option_dict.onClose(dialog);
                }  
              }
            });
        }

        // expose
        CodeMirror.navigationMenu.evaluateState = dialog_evaluateState;
  
        text_input = dialog_getTextInput(dialog);
        if (text_input) {
          text_input.focus();
          
          if (my_option_dict.value) {
            text_input.value = my_option_dict.value;
            if (my_option_dict.selectValueOnOpen !== false) {
              text_input.select();
            }
          }
          text_input_value = text_input.value;

          if (my_option_dict.onInput) {
            event_list.push(
              loopEventListener(text_input, "input", false, function (my_event) {
                return my_option_dict.onInput(my_event, text_input_value, dialog_evaluateState);
              })
            );
          }

          // never close on blur of textinput
          if (my_option_dict.closeOnBlur !== false) {
            event_list.push(
              loopEventListener(text_input, "blur", false, function (my_event) {
                if (my_option_dict.onBlur) {
                  return my_option_dict.onBlur(my_event, text_input_value, dialog_evaluateState);
                }
              })
            );
          }
        }

        if (my_option_dict.onKeyUp) {
          event_list.push(
            loopEventListener(text_input, "keyup", false, function (my_event) {
              return my_option_dict.onKeyUp(my_event, text_input_value, dialog_evaluateState);
            })
          );
        }

        if (my_option_dict.onKeyDown) {
          event_list.push(
            loopEventListener(text_input, "keydown", false, function (my_event) {
              
              // close on ESC
              // XXX Move to resolve handler vs just closing here
              if (my_event.keyCode == 27) {
                text_input.blur();
                CodeMirror.e_stop(my_event);
                return dialog_evaluateState();
              }
              return my_option_dict.onKeyDown(my_event, text_input_value, dialog_evaluateState);
            })
          );
        }

        // form submits
        closing_event_list.concat(setFormSubmitListeners(dialog, my_gadget));
  
        // create file menu
        if (CodeMirror.navigationMenu.position === 'left') {
          storage_interaction_list.push(
            new RSVP.Queue()
              .push(function () {
                return my_gadget.jio_allDocs();
              })
              .push(function (my_directory_list) {
                var response_dict = my_directory_list.data.rows.data,
                  directory_content_list = [],
                  cache_id,
                  i;

                if (my_directory_list !== undefined) {
                  entry_dict = {};
                  for (i = 0; i < response_dict.total_rows; i += 1) {
                    cache_id = response_dict.rows[i].id;
                    entry_dict[i] = {"name": cache_id, "item_list": []};
                    directory_content_list.push(
                      my_gadget.jio_allAttachments(cache_id)
                    );
                  }
                }
                return RSVP.all(directory_content_list);
              })
              .push(function (my_directory_content) {
                var len = my_directory_content.length,
                  item,
                  i;

                if (len > 0) {
                  for (i = 0; i < len; i += 1) {
                    response = my_directory_content[i].data;
                    for (item in response) {
                      if (response.hasOwnProperty(item)) {
                        entry_dict[i].item_list.push(item);
                      }
                    }  
                  }
                }
                dialog.insertBefore(
                  setFileMenu(entry_dict),
                  dialog.querySelector('span')
                );
              })
            );
        }
  
        // gogo-gadget-oh rsvp...
        // XXX always close the dialog through this, resolve all promises?
        return new RSVP.Queue()
          .push(function () {
            closeNotification(my_context, null);
            return RSVP.all(storage_interaction_list);
          })
          .push(function () {
            return RSVP.all([
              RSVP.all(event_list),
              RSVP.any(closing_event_list)
            ]);
          })
          .push(function (my_return_close) {
            return dialog_evaluateState();
          });
      }
    );
  }

  function setNavigationMenu(my_direction) {
    switch (CodeMirror.navigationMenu.position) {
      case "idle":
        CodeMirror.navigationMenu.position = my_direction;
        if (my_direction === "right") {
          return OBJECT_MENU_TEMPLATE;
        }
        return OBJECT_LIST_TEMPLATE;
      case "left":
        if (my_direction === "left") {
          return OBJECT_LIST_TEMPLATE;
        }
        CodeMirror.navigationMenu.position = "idle";
        return;
      case "right":
        if (my_direction === "left") {
          CodeMirror.navigationMenu.position = "idle";
          return;
        }
        return OBJECT_LIST_TEMPLATE;
    }
  }

  function setNavigationCallback(my_event, my_value, my_callback) {
    if (my_event.ctrlKey && my_event.altKey) {
      switch(my_event.keyCode) {
        
        // Save
        case 83:
          console.log("DELETE 83");
          break;
        
        // Delete
        case 68:
          console.log("DELETE 68");
          break;

        // Close
        case 67:
          console.log("CLOSE 67");
          my_callback();
        break;
      
        // Left
        case 37:
          if (setNavigationMenu("left") === undefined) {
            console.log("CLOSE 37");
            my_callback();
          }
          break;
          
        // Right
        case 39:
          if (setNavigationMenu("right") === undefined) {
            console.log("CLOSE 39");
            my_callback();
          }
          break;

        default:
          console.log("keycode:", my_event.keyCode);
        break;
      }  
    }
  }


  // http://codemirror.net/doc/manual.html#addon_dialog
  function enterCallback(my_selected_value, my_event) {
  }  
  
  function navigateHorizontal(my_codemirror, my_direction) {
    if (CodeMirror.navigationMenu.position === "idle") {
      my_codemirror.openDialog(
        setNavigationMenu(my_direction),
        enterCallback,
        {
          "bottom": false,
          "closeOnEnter": false,
          "closeOnBlur": false,
          "value": null,
          "selectValueOnOpen": false,
          "onKeyUp": function (my_event, my_value, my_callback) {
            setNavigationCallback(my_event, my_value, my_callback);
            return true;
          },
          "onInput": function (my_event, my_value, my_callback) {
            setNavigationCallback(my_event, my_value, my_callback);
            return true;
          }
        }
      );
    } else if (my_direction !== CodeMirror.navigationMenu.position) {
      
      // resolve promise chain, not just close
      CodeMirror.navigationMenu.evaluateState();
    }
  }

  function navigateRight(cm) {
    return navigateHorizontal(cm, "right");
  }
  CodeMirror.commands.myNavigateRight = navigateRight;

  function navigateLeft(cm) {
    return navigateHorizontal(cm, "left");
  }
  CodeMirror.commands.myNavigateLeft = navigateLeft;
  
  // CodeMirror.keyMap.my["Ctrl-Alt-A"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-B"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-C"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-D"] = undefined;
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
  // CodeMirror.keyMap.my["Ctrl-Alt-O"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-P"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-Q"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-R"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-S"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-T"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-U"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-V"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-W"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-X"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-Y"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt-Z"] = undefined;
  // CodeMirror.keyMap.my["Ctrl-Alt--"] = undefined;
  CodeMirror.keyMap.my["Ctrl-Alt-Right"] = "myNavigateRight";
  CodeMirror.keyMap.my["Ctrl-Alt-Left"] = "myNavigateLeft";
  // CodeMirror.keyMap.my["Ctrl-Alt-Return"] = undefined;



  var editorURI;
  var editorTextarea;
  var editor;
  var commands = {};
  var ecc = new toolbox.ExtendedCancellableChain();




  ///////////
  // Tools //
  ///////////

  // Object.keys(CodeMirror.mimeModes).map(function (mime) {
  //  return '"' + CodeMirror.mimeModes[mime] + '": "' + mime + '"'; })
  //    .join(",\n")

  var modeMimes = {
    "undefined": "text/plain",
    "null": "text/plain",
    "css": "text/css",
    "javascript": "application/javascript",
    "htmlmixed": "text/html",
    "xml": "application/xml",
    "python": "text/x-python",
    "clike": "text/x-c",
    "java": "text/x-java",
    "csharp": "text/x-csharp",
    "scala": "text/x-scala",
    "markdown": "text/x-markdown",
    "php": "text/x-php",
    "diff": "text/x-diff",
    "rst": "text/x-rst",
    "stex": "text/x-stex",
    "perl": "text/x-perl",
    "ruby": "text/x-ruby",
    "shell": "text/x-sh",
    "sql": "text/x-sql",
    "go": "text/x-go"
  };

  var modeShortcuts = {
    "c": "clike",
    "c++": "clike",
    "c#": "csharp",
    "html": "htmlmixed",
    "js": "javascript",
    "md": "markdown",
    "py": "python",
    "sh": "shell"
  };
  
  function setModified(cm) { cm.modified = true; }

  function commandPrompt(cm) {
    // XXX allow the use of space character (like in bash interpreter)
    var text = prompt("Command (type `help` to get a list of commands)"), args;
    if (text) {
      args = text.split(/\s+/);
      commands[args[0]](cm, args);
    }
  }
      
  function randomChoose(array) {
    return array[parseInt(Math.random() * array.length, 10)];
  }


(function (window, rJS) {
  "use strict";

  rJS(window)
  
    /////////////////////////////
    // ready
    /////////////////////////////
    .ready(function (my_gadget) {
      my_gadget.property_dict = {};
      
      return new RSVP.Queue()
        .push(function () {
          return my_gadget.getElement();
        })
        .push(function (my_element) {
          my_gadget.property_dict.element = my_element;
          my_gadget.property_dict.uri = undefined;
          my_gadget.property_dict.textarea = my_element.querySelector("textarea");
        });
    })
    .ready(function (my_gadget) {
      editorURI = my_gadget.property_dict.uri || window.location.hash.slice(1);
      if (my_gadget.property_dict.textarea) {
        editorTextarea = my_gadget.property_dict.textarea;
      } else {
        editorTextarea = document.createElement("textarea");
        my_gadget.property_dict.textarea = editorTextarea;
        my_gadget.property_dict.element.appendChild(editorTextarea);
      }

      commands["help doc"] = "Shows this help.";
      commands.help = function () {
        alert(Object.keys(commands).reduce(function (prev, curr) {
          if (curr.indexOf(" ") !== -1) {
            return prev;
          }
          prev += curr;
          if (commands[curr + " doc"]) {
            prev += "\t\t\t" + commands[curr + " doc"];
          }
          return prev + "\n";
        }, ""));
      };
      commands["mode doc"] = "{javascript|html|python|...}";
      commands.mode = function (cm, args) {
        cm.setOption("mode", modeShortcuts[args[1]] || args[1]);
        cm.setOption("lint", false);
        if (cm.getOption("myAutoLint") && CodeMirror.lint[cm.getOption("mode")]) {
          setTimeout(function () { cm.setOption("lint", true); });
        }
      };
      commands["lint doc"] = "Toggle automatic lint";
      commands.lint = function (cm) {
        if (cm.getOption("lint")) {
          cm.setOption("myAutoLint", false);
          cm.setOption("lint", false);
        } else if (CodeMirror.lint[cm.getOption("mode")]) {
          cm.setOption("myAutoLint", true);
          cm.setOption("lint", true);
        }
      };
      commands["keyMap doc"] = "{default|my|emacs|vim}";
      commands.keyMap = function (cm, args) {
        cm.setOption("keyMap", args[1] || "default");
      };
      commands["theme doc"] = "{default|random|rubyblue|monokai|blackboard|...}";
      commands.theme = function (cm, args) {
        if (args[1] === "random") {
          cm.setOption("theme", randomChoose(["3024-night", "monokai", "blackboard", "rubyblue", "cobalt"]));
          return;
        }
        cm.setOption("theme", args.slice(1).join(" ") || "default");
      };
      
      return dialog_setDialogExtension(my_gadget);
    })

    /////////////////////////////
    // declared methods
    /////////////////////////////
    .declareMethod('render', function (my_option_dict) {
      var gadget = this;

      CodeMirror.commands.save = function (cm) { commands.save(cm, ["save"]); };
      CodeMirror.keyMap.default.F3 = "findNext";
      CodeMirror.keyMap.default["Shift-F3"] = "findPrev";
      CodeMirror.lint["application/javascript"] = CodeMirror.lint.javascript;
      CodeMirror.lint["application/json"] = CodeMirror.lint.json;
      CodeMirror.lint["text/css"] = CodeMirror.lint.css;
    
    
      editor = CodeMirror.fromTextArea(gadget.property_dict.textarea, {
        readOnly: false,

        // http://codemirror.net/doc/manual.html#addons
        // addon/edit/matchbrackets.js
        matchBrackets: true,
        // addon/edit/closebrackets.js
        autoCloseBrackets: false,
        // addon/edit/trailingspace.js
        showTrailingSpace: true,
        // addon/display/fullscreen.{js,css}
        fullScreen: true, // start full screen
    
        // http://codemirror.net/doc/manual.html#config
    
        keyMap: "my", // default "default"
        showCursorWhenSelecting: true,
    
        extraKeys: {
          "Ctrl-O": function (cm) {
            setTimeout(commands.open, 0, cm, ["open"]);
          },
          "Alt-;": commandPrompt,
          "Alt-:": commandPrompt,
          "Shift-Alt-;": commandPrompt,
          "Shift-Alt-:": commandPrompt
        },
    
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

      window.editor = editor;
      return gadget;
    })

    /////////////////////////////
    // declared service
    /////////////////////////////    
    .declareService(function () {
      window.editor.refresh();
      window.editor.focus();

      return new RSVP.Queue()
        .push(function () {
          return RSVP.any([
            //loopEventListener(editor, 'change', false, setModified),
            promiseEventListener(window, "onbeforeunload", true)
          ]);
        })
        .push(function () {
          if (editor.getOption("readOnly")) {
            return "An action is on going! May be saving your work!";
          }
          if (editor.modified) {
            return "Don't forget to save your work!";
          }
        });
    })

    /////////////////////////////
    // published methods
    /////////////////////////////

    /////////////////////////////
    // acquired methods
    /////////////////////////////
    .declareAcquiredMethod('jio_allDocs', 'jio_allDocs')
    .declareAcquiredMethod('jio_allAttachments', 'jio_allAttachments');

}(window, rJS));
