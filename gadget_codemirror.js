/*jslint indent: 2, vars: true, nomen: true, maxerr: 3 */
/*global window, rJS, document, location, alert, prompt, confirm, setTimeout,
  CodeMirror, loopEventListener */

  /////////////////////////////
  // Placeholder
  /////////////////////////////
  var PLACEHOLDER = "Textitor Shortcuts:\n" +
    "[CTRL+ALT+x] Close Dialog";

  /////////////////////////////
  // Supported Modes
  /////////////////////////////
  var modeMimes = {
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

  var shimModeMimes = {
    "html": "htmlmixed",
    "js": "javascript",
    "py": "python",
    "md": "markdown"
  };
 
  var dialog_option_dict = {
    "bottom": false,
    "closeOnEnter": false,
    "closeOnBlur": false,
    "value": null,
    "selectValueOnOpen": false,
    "onKeyUp": function (my_event, my_value, my_callback) {
      return setNavigationCallback(my_event, my_value, my_callback);
    },
    "onInput": function (my_event, my_value, my_callback) {
      return setNavigationCallback(my_event, my_value, my_callback);
    }
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
    "<input type='text' tabindex='1' />" +
    "<span class='custom-menu-typewriter'>CTRL+ALT+</span>" +
    "<form name='search'>" +
      "<button type='submit' tabindex='2' class='custom-menu-button'>" +
        "<b>F</b>ind</button></form>" +
    "<form name='saveall'>" +
      "<button type='submit' tabindex='3' class='custom-menu-button'>" +
        "<b>S</b>ave All</button></form>";

  /////////////////////////////
  // CodeMirror "Globals"
  /////////////////////////////
  CodeMirror.keyMap.my = {"fallthrough": "default"};
  CodeMirror.menu_dict = {};
  CodeMirror.menu_dict.position = "idle";
  CodeMirror.menu_dict.editor_createDoc = function (my_content) {
    var new_doc,content, history;

    if (my_content) {
      content = my_content[0].target.result;
      history = my_content[1].target.result;
      new_doc = CodeMirror.Doc(content);
      if (history) {
        new_doc.setHistory(JSON.parse(history));
      }
     return new_doc;
    }
    return CodeMirror.Doc("");
  };

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
  
  // loopEventListener for CodeMirror events (non DOM)
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
  // base
  /////////////////////////////
  function base_isType(my_variable) {
    return Object.prototype.toString.call(my_variable);
  }
  
  function base_convertToArray(my_object) {
    return Array.prototype.slice.call(my_object);
  }

  //////////////////////////////
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
          str += parseTemplate(
            FILE_ENTRY_TEMPLATE,
            [folder.name + " | " + folder.item_list[i]]
          );
        }
      }
    }
    // XXX: WTFix
    str = parseTemplate(FILE_MENU_TEMPLATE, [str]);
    div = document.createElement("div");
    div.innerHTML = str;
    return div.firstChild;
  }

  function setFileMenuItem(my_dialog, my_direction) {
    var file_menu = my_dialog.querySelector(".custom-file-menu"),
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

  function is_validMimeType(my_mime_type) {
    var mime;
    for (mime in modeMimes) {
      if (modeMimes.hasOwnProperty(mime)) {
        if (my_mime_type == modeMimes[mime]) {
          return true;
        }
      }
    }
  }

  function dialog_flagInput(my_input, my_message) {
    return new RSVP.Queue()
      .push(function () {
        my_input.className += ' custom-invalid';
        my_input.value = my_message;
        my_input.blur();

        return promiseEventListener(my_input, 'focus', false);
      })
      .push(function () {
        my_input.className = '';
        my_input.value = '';
      });
  }

  /////////////////////////////
  // form handling
  /////////////////////////////
  function is404(my_error) {
    if ((my_error instanceof jIO.util.jIOError) &&
      (my_error.status_code === 404)) {
      return true; 
    }
    return null;
  }


  function dialog_updateStorage(my_gadget, my_dialog, my_parameter) {
    var active_cache,
      active_file,
      file_name_input,
      mime_type_input,
      is_cache_name,
      file_name,
      action,
      content,
      entry_dict;
    
    // determine action
    if (my_parameter && my_parameter.target) {
      action = my_parameter.target.name;
    }

    // open = get from memory or serviceworker, close previous file    
    if (action === "open") {
      file_name_input = my_dialog.querySelector('input:checked');
      if (file_name_input) {

        active_cache = CodeMirror.menu_dict.active_cache || "textitor";
        file_name = file_name_input.nextSibling.textContent.split(" | ")[1];
        console.log(file_name)

        // set modified if it's a file which was not saved before
        if (file_name.indexOf("*") > 0) {
          console.log("WE SHOULD BLINK SAVE")
        //  CodeMirror.menu_dict.editor_setModified();
        }

        // drop the star
        file_name = file_name.split("*")[0];
        
        return new RSVP.Queue()
          .push(function () {
            return my_gadget.setActiveStorage("memory");
          })
          .push(function () {
            return RSVP.all([
              my_gadget.jio_getAttachment(active_cache, file_name),
              my_gadget.jio_getAttachment(active_cache, file_name + "_history")
            ]);
          })
          .push(null, function (my_error) {
            if (is404(my_error)) {
              return new RSVP.Queue()
                .push(function () {
                  return my_gadget.setActiveStorage("serviceworker");
                })
                .push(function () {
                  return RSVP.all([
                    my_gadget.jio_getAttachment(active_cache, file_name),
                    new Blob([])
                  ]);
                })
                .push(null, function (err) {
                  console.log(err);
                  throw err;
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
            return new RSVP.Queue()
              .push(function () {
                return my_gadget.setActiveStorage("memory");
              })
              .push(function () {
                var new_doc = CodeMirror.menu_dict.editor_createDoc(my_content), 
                  old_doc = my_gadget.property_dict.editor.swapDoc(new_doc),
                  menu_dict = CodeMirror.menu_dict,
                  active_storage,
                  save_file_name,
                  save_mime_type;

                if (menu_dict.active_file && CodeMirror.menu_dict.is_modified) {
                  active_storage = menu_dict.active_cache || "textitor";
                  save_file_name = menu_dict.active_file.name;
                  save_mime_type = menu_dict.active_file.mime_type;
  
                  return RSVP.all([
                    my_gadget.jio_putAttachment(
                      active_storage,
                      save_file_name, 
                      new Blob([old_doc.getValue()], {type: save_mime_type})
                    ),
                    my_gadget.jio_putAttachment(
                      active_storage,
                      save_file_name + "_history",
                      new Blob([JSON.stringify(old_doc.getHistory())], {
                        'type': "application/json"
                      })
                    )
                  ]);
                }
              });      
            })
            .push(function () {
              my_gadget.property_dict.editor.setOption("mode", mime_type);
              editor_setActiveFile(file_name, mime_type);
              CodeMirror.menu_dict.editor_resetModified();
              return true;
            })
            .push(null, function (err) {
              console.log(err);
              throw err;
            });
      
      // close if no file is selected on opening
      } else {
        return true;
      }
    }
    
    // close = store file on memory until it is saved
    if (action === "close") {
      
      return new RSVP.Queue()
        .push(function () {
          return my_gadget.setActiveStorage("memory");
        })
        .push(function () {
          var new_doc = CodeMirror.Doc(""), 
            old_doc = my_gadget.property_dict.editor.swapDoc(new_doc),
            menu_dict = CodeMirror.menu_dict,
            active_storage = menu_dict.active_cache || "textitor",
            active_file = menu_dict.active_file,
            save_file_name,
            save_mime_type;

          // XXX rename file, check form here
          if (active_file && CodeMirror.menu_dict.is_modified) {
            save_file_name = menu_dict.active_file.name,
            save_mime_type = menu_dict.active_file.mime_type;
            
            return RSVP.all([
              my_gadget.jio_putAttachment(
                active_storage,
                save_file_name, 
                new Blob([old_doc.getValue()], {type: save_mime_type})
              ),
              my_gadget.jio_putAttachment(
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
          dialog_clearTextInput(my_dialog);
          CodeMirror.menu_dict.editor_resetModified();
          return true;
        })
        .push(null, function (err) {
          console.log(err);
          throw err;
        });
    }

    // save = store on serviceworker, remove from memory
    if (action === "save") {
      file_name_input = my_dialog.querySelector("input[type='text']");
      file_name = file_name_input.value;
      is_cache_name = my_dialog.querySelector('input:checked');
      content = my_gadget.property_dict.editor.getValue();
      
      // empty
      if (!file_name && !content) {
        return true;
      }

      // validate
      if (!file_name) {
        return dialog_flagInput(file_name_input, 'Enter valid URL.');
      }

      // not a cache
      if (!is_cache_name) {
        mime_type_input = file_name.split(".").pop().replace("/", "");
        mime_type = modeMimes[mime_type_input] ||
            modeMimes[shimModeMimes[mime_type_input]] ||
                "text/plain";
      } else {

        // XXX: missing cache handling
        return dialog_flagInput(file_name_input, 'Create Cache not supported');
      }

      active_cache = CodeMirror.menu_dict.active_cache || "textitor";

      return new RSVP.Queue()
        .push(function () {
          return new RSVP.Queue()
            .push(function () {
              return my_gadget.setActiveStorage("memory");
            })
            .push(function () {
              return my_gadget.jio_getAttachment(active_cache, file_name);
            })
            .push(function () {
              return RSVP.all([
                my_gadget.jio_removeAttachment(active_cache, file_name),
                my_gadget.jio_removeAttachment(active_cache, file_name + "_history")
              ]);
            })
            .push(null, function (my_error) {
              if (is404(my_error)) {
                return;
              }
              throw my_error;
            });
        })
        .push(function() {
          return my_gadget.setActiveStorage("serviceworker");
        })
        .push(function() {
          return my_gadget.jio_putAttachment(
            active_cache,
            file_name,
            new Blob([content], {type: mime_type})
          );
        })
        .push(function () {
          my_gadget.property_dict.editor.setOption("mode", mime_type);
          editor_setActiveFile(file_name, mime_type);
          CodeMirror.menu_dict.editor_resetModified();
          return true;
        })
        .push(undefined, function (my_error) {
          console.log(my_error);
          throw my_error;
        });
    }

    // delete file from memory and serviceworker
    if (action === "remove") {
      active_cache = CodeMirror.menu_dict.active_cache || "textitor";
      file_name = CodeMirror.menu_dict.active_file.name;

      if (file_name) {
        return new RSVP.Queue()
          .push(function () {
            return my_gadget.setActiveStorage("memory");
          })
          .push(function () {
            return my_gadget.jio_getAttachment(active_cache, file_name);
          })
          .push(function () {
            return RSVP.all([
              my_gadget.jio_removeAttachment(active_cache, file_name),
              my_gadget.jio_removeAttachment(active_cache, file_name + "_history")
            ]);
          })
          .push(null, function (my_error) {
            if (is404(my_error)) {
              return;
            }
          })
          .push(function () {
            return my_gadget.setActiveStorage("serviceworker");
          })
          .push(function () {
            return my_gadget.jio_removeAttachment(active_cache, file_name);
          })
          .push(function () {
            var new_doc = CodeMirror.Doc(""), 
              old_doc = my_gadget.property_dict.editor.swapDoc(new_doc);
            editor_resetActiveFile();
            CodeMirror.menu_dict.editor_resetModified();
            return true;
          })
          .push(null, function (my_error) {
            console.log(my_error);
            throw my_error;
          });
      }
    }

    // XXX resolve promise chain! not just close
    if (my_parameter !== undefined) {
      return false;
    }
    return true;
  }

  function setFormSubmitListeners(my_dialog, my_gadget) {
    var form_list = my_dialog.querySelectorAll('form'),
      event_list = [],
      len,
      i;
    
    function dialog_setFormSubmitHandler(my_form) {
      return loopEventListener(my_form, "submit", false, function (my_event) {
        return CodeMirror.menu_dict.evaluateState(my_event);
      });
    }
    
    for (i = 0, len = form_list.length; i < len; i += 1) {
      event_list.push(dialog_setFormSubmitHandler(form_list[i]));
    }
    return event_list;
  }
  
  function dialog_clearTextInput(my_dialog) {
    var input_list = base_convertToArray(my_dialog.querySelectorAll("input")),
      len,
      i;
    for (i = 0, len = input_list.length; i < len; i += 1) {
      if (input_list[i].type === 'text') {
        input_list[i].value = '';
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
          memory_list,
          entry_dict,
          dialog,
          text_input,
          my_context;

        my_context = my_context || this;
        my_option_dict = my_option_dict || {};
        dialog = setDialog(my_context, my_template, my_option_dict.bottom);

        // evaluate state
        function dialog_evaluateState(my_parameter) {
          return new RSVP.Queue()
            .push(function () {
              return dialog_updateStorage(my_gadget, dialog, my_parameter);
            })
            .push(function (my_close_dialog) {
              if (my_close_dialog === true) {
                dialog.parentNode.removeChild(dialog);
                my_context.focus();
                CodeMirror.menu_dict.position = "idle";
        
                if (my_option_dict.onClose) {
                  my_option_dict.onClose(dialog);
                }
              }
            });
        }
        CodeMirror.menu_dict.evaluateState = dialog_evaluateState;
        
        function dialog_updateFileMenu(my_parameter) {
          return setFileMenuItem(dialog, my_parameter);
        }
        CodeMirror.menu_dict.updateFileMenu = dialog_updateFileMenu;

        // XXX: this can be any dialog. make it more specific (= single file)
        text_input = dialog.querySelector("input[type='text']");
        if (text_input) {
          text_input.focus();
          text_input.value = my_option_dict.value || editor_getActiveFile()[0];
          if (my_option_dict.selectValueOnOpen !== false) {
            text_input.select();
          }
          if (my_option_dict.onInput) {
            event_list.push(
              loopEventListener(text_input, "input", false, function (my_event) {
                return my_option_dict.onInput(my_event, text_input.value, dialog_evaluateState);
              })
            );
          }

          // never close on blur of textinput
          if (my_option_dict.closeOnBlur !== false) {
            event_list.push(
              loopEventListener(dialog, "blur", false, function (my_event) {
                if (my_option_dict.onBlur) {
                  return my_option_dict.onBlur(my_event, text_input.value, dialog_evaluateState);
                }
              })
            );
          }
        }

        if (my_option_dict.onKeyUp) {
          event_list.push(
            loopEventListener(dialog, "keyup", false, function (my_event) {
              return my_option_dict.onKeyUp(my_event, text_input.value, dialog_evaluateState);
            })
          );
        }

        if (my_option_dict.onKeyDown) {
          event_list.push(
            loopEventListener(dialog, "keydown", false, function (my_event) {
              return my_option_dict.onKeyDown(my_event, text_input.value, dialog_evaluateState);
            })
          );
        }

        // form submits
        closing_event_list.concat(setFormSubmitListeners(dialog, my_gadget));
  
        // create file menu
        if (CodeMirror.menu_dict.position === 'left') {
          storage_interaction_list.push(
            new RSVP.Queue()
              .push(function () {
                return my_gadget.setActiveStorage("memory");
              })
              .push(function () {
                return my_gadget.jio_allDocs();
              })
              .push(function (my_directory_list) {
                var response_dict = my_directory_list.data,
                  directory_content_list = [],
                  len = response_dict.total_rows,
                  cache_id,
                  i;

                for (i = 0; i < len; i += 1) {
                  entry_dict = entry_dict || {};
                  cache_id = response_dict.rows[i].id;
                  entry_dict[i] = {"name": cache_id, "item_list": []};
                  directory_content_list.push(
                    my_gadget.jio_allAttachments(cache_id)
                  );
                }
                return RSVP.all(directory_content_list);
              })
              .push(function (my_memory_content) {
                var len = my_memory_content.length,
                  item,
                  i;

                for (i = 0, memory_list = []; i < len; i += 1) {
                  response = my_memory_content[i];
                  for (item in response) {
                    if (response.hasOwnProperty(item)) {
                      memory_list.push(item);
                    }
                  }  
                }
                return my_gadget.setActiveStorage("serviceworker");
              })
              .push(function () {
                return my_gadget.jio_allDocs();
              })
              .push(function (my_directory_list) {
                var response_dict = my_directory_list.data,
                  directory_content_list = [],
                  len = response_dict.total_rows,
                  cache_id,
                  i;
                if (my_directory_list !== undefined) {
                  entry_dict = {};
                  if (len === 1) {
                    CodeMirror.menu_dict.active_cache = response_dict.rows[0].id;
                  }
                  for (i = 0; i < len; i += 1) {
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
                dialog.insertBefore(
                  setFileMenu(entry_dict),
                  dialog.querySelector('span')
                );
              })
              .push(null, function (err) {
                console.log(err);
                throw err;
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
          })
          .push(undefined, function (my_error) {
            throw my_error;
          });
      }
    );
  }

  function setNavigationCallback(my_event, my_value, my_callback) {
    
    // handle direct shortcuts, without dialog (and listeners) active
    
    // esc
    if (my_event.keyCode === 27) {
      CodeMirror.commands.myEditor_closeDialog(my_event);
    }

    // ovrride chrome page start/end shortcut
    if (my_event.keyCode === 35) {
      console.log("navigate up key?")
      CodeMirror.commands.myEditor_navigateVertical(undefined, "up");
    }
    if (my_event.keyCode === 36) {
      CodeMirror.commands.myEditor_navigateVertical(undefined, "down");
    }

    // input
    if (my_event.type === "input") {
      my_callback(my_value);
    }

    // ctrl + alt +
    if (my_event.ctrlKey && my_event.altKey) {
      switch(my_event.keyCode) {
        case 68: return CodeMirror.commands.myEditor_deleteFile();  // (d)elete file
        case 67: return CodeMirror.commands.myEditor_closeFile();   // (c)lose file
        case 79: return CodeMirror.commands.myEditor_openFromDialog(); // (o)pen
        case 83: return CodeMirror.commands.myEditor_saveFromDialog(CodeMirror); // (s)ave
        case 88: return CodeMirror.commands.myEditor_closeDialog(); // (x)lose dialog
        case 37: return CodeMirror.commands.myEditor_navigateHorizontal(undefined, "left");
        case 38: return CodeMirror.commands.myEditor_navigateVertical(undefined, "up");
        case 39: return CodeMirror.commands.myEditor_navigateHorizontal(undefined, "right");
        case 40: return CodeMirror.commands.myEditor_navigateVertical(undefined, "down");
      }  
    }
  }

  function editor_setNavigationMenu(my_direction) {
    switch (CodeMirror.menu_dict.position) {
      case "idle":
        CodeMirror.menu_dict.position = my_direction;
        if (my_direction === "right") {
          return parseTemplate(OBJECT_MENU_TEMPLATE, editor_getActiveFile());
        }
        return OBJECT_LIST_TEMPLATE;
      case "left":
        if (my_direction === "left") {
          return OBJECT_LIST_TEMPLATE;
        }
        CodeMirror.menu_dict.position = "idle";
        return;
      case "right":
        if (my_direction === "left") {
          CodeMirror.menu_dict.position = "idle";
          return;
        }
        return OBJECT_LIST_TEMPLATE;
    }
  }
  
  // active file
  function editor_resetActiveFile() {
    CodeMirror.menu_dict.active_file = null;
  }
  function editor_setActiveFile(my_name, my_mime_type) {
    CodeMirror.menu_dict.active_file = CodeMirror.menu_dict.active_file || {};
    CodeMirror.menu_dict.active_file.name = my_name;
    CodeMirror.menu_dict.active_file.mime_type = my_mime_type;
  }
  function editor_getActiveFile() {
    var active_file = CodeMirror.menu_dict.active_file || {};
    return [active_file.name || "", active_file.mime_type || ""];
  }

  // shortcut handlers
  function editor_closeFile() {
    if (CodeMirror.menu_dict.evaluateState) {
      return CodeMirror.menu_dict.evaluateState({"target":{"name": "close"}});
    }
  }
  CodeMirror.commands.myEditor_closeFile = editor_closeFile;
  
  function editor_deleteFile() {
    if (CodeMirror.menu_dict.evaluateState) {
      return CodeMirror.menu_dict.evaluateState({"target": {"name": "remove"}});
    }
  }
  CodeMirror.commands.myEditor_deleteFile = editor_deleteFile;
  
  function editor_closeDialog(my_event) {
    if (CodeMirror.menu_dict.evaluateState) {
      return CodeMirror.menu_dict.evaluateState();
    }
  }
  CodeMirror.commands.myEditor_closeDialog = editor_closeDialog;

  function editor_saveFromDialog(my_codemirror) {
    if (CodeMirror.menu_dict.position !== "left") {
      
      // evaluateState is declared on first dialog open, if someone saves before
      // opening, it would raise an error so we default to opening the dialog
      if (CodeMirror.menu_dict.evaluateState) {
        return CodeMirror.menu_dict.evaluateState({"target":{"name": "save"}});
      } else {
        return my_codemirror.openDialog(
          editor_setNavigationMenu("right"),
          editor_closeCallback,
          dialog_option_dict
        );
      }
    }
  }
  CodeMirror.commands.myEditor_saveFromDialog = editor_saveFromDialog;

  function editor_openFromDialog() {
    if (CodeMirror.menu_dict.position === "left") {
      return CodeMirror.menu_dict.evaluateState({"target":{"name": "open"}});
    }
  }
  CodeMirror.commands.myEditor_openFromDialog = editor_openFromDialog;

  function editor_closeCallback(my_selected_value, my_event) {}

  function editor_navigateHorizontal(my_codemirror, my_direction) {
    var position = CodeMirror.menu_dict.position,
      parameter;

    if (position === "idle") {
      return my_codemirror.openDialog(
        editor_setNavigationMenu(my_direction),
        editor_closeCallback,
        dialog_option_dict
      );
    }
    if (position === my_direction) {
      parameter = false;
    }
    if (position === "right" && my_direction === "left" 
      && CodeMirror.menu_dict.active_file) {
      parameter = {"target": {"name": "save"}};
    }
    if (position === "left" && my_direction === "right") {
      parameter = {"target": {"name": "open"}};
    }
    return CodeMirror.menu_dict.evaluateState(parameter);
  }
  CodeMirror.commands.myEditor_navigateHorizontal = editor_navigateHorizontal;

  function editor_navigateVertical(my_codemirror, my_direction) {
    console.log("VERTICAL")
    console.log(my_direction)
    return CodeMirror.menu_dict.updateFileMenu(my_direction);
  }
  CodeMirror.commands.myEditor_navigateVertical = editor_navigateVertical;

  function editor_navigateRight(cm) {
    return CodeMirror.commands.myEditor_navigateHorizontal(cm, "right");
  }
  CodeMirror.commands.myEditor_navigateRight = editor_navigateRight;

  function editor_navigateLeft(cm) {
    return CodeMirror.commands.myEditor_navigateHorizontal(cm, "left");
  }
  CodeMirror.commands.myEditor_navigateLeft = editor_navigateLeft;
  
  function editor_navigateUp(cm) {
    console.log("navigate up?")
    return CodeMirror.commands.myEditor_navigateVertical(cm, "up");
  }
  CodeMirror.commands.myEditor_navigateUp = editor_navigateUp;
  
  function editor_navigateDown(cm) {
    return CodeMirror.commands.myEditor_navigateVertical(cm, "down");
  }
  CodeMirror.commands.myEditor_navigateDown = editor_navigateDown;

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
          my_gadget.property_dict.textarea = my_element.querySelector("textarea");
        });
    })
    .ready(function (my_gadget) {
      var editorTextarea;
      if (my_gadget.property_dict.textarea) {
        editorTextarea = my_gadget.property_dict.textarea;
      } else {
        editorTextarea = document.createElement("textarea");
        my_gadget.property_dict.textarea = editorTextarea;
        my_gadget.property_dict.element.appendChild(editorTextarea);
      }

      return dialog_setDialogExtension(my_gadget);
    })

    /////////////////////////////
    // declared methods
    /////////////////////////////
    .declareMethod('render', function (my_option_dict) {
      var gadget = this,
        dict = gadget.property_dict;

      CodeMirror.menu_dict.editor_setModified = function () {
        if (CodeMirror.menu_dict.is_modified !== true) {
          CodeMirror.menu_dict.is_modified = true;
          dict.element.querySelector(".CodeMirror").className += 
            " custom-set-modified";
        }
      };
      CodeMirror.menu_dict.editor_resetModified = function () {
        var element = dict.element.querySelector(".CodeMirror");
        CodeMirror.menu_dict.is_modified = null;
        element.className = element.className
          .split("custom-set-modified").join("");
      };
    
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
    })

    /////////////////////////////
    // declared service
    /////////////////////////////    
    .declareService(function () {
      var gadget = this,
        editor = gadget.property_dict.editor,
        editor_setModified = CodeMirror.menu_dict.editor_setModified;

      editor.refresh();
      editor.focus();
      return new RSVP.Queue()
        .push(function () {
          return RSVP.all([
            codeMirrorLoopEventListener(editor, 'change', editor_setModified),
            promiseEventListener(window, "onbeforeunload", true)
          ]);
        })
        .push(function () {
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
    .declareAcquiredMethod('setActiveStorage', 'setActiveStorage')
    .declareAcquiredMethod('jio_create', 'jio_create')
    .declareAcquiredMethod('jio_allDocs', 'jio_allDocs')
    .declareAcquiredMethod('jio_allAttachments', 'jio_allAttachments')
    .declareAcquiredMethod('jio_putAttachment', 'jio_putAttachment')
    .declareAcquiredMethod('jio_removeAttachment', 'jio_removeAttachment')
    .declareAcquiredMethod('jio_getAttachment', 'jio_getAttachment');

}(window, rJS));

