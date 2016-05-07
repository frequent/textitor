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

  var modeShortcuts = {
    "html": "htmlmixed",
    "js": "javascript",
    "md": "markdown",
    "py": "python"
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
    "<span class='custom-menu-label'>Mime-Type:</span>" +
    "<input type='text' tabindex='2' placeholder='mime-type' value='%s' />" +
    "<span class='custom-menu-label'>Create as Cache</span>" +
    "<input type='checkbox' tabindex='3' autocomplete='off' />" +
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
  CodeMirror.menu_dict = {"position": "idle"};

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
        //CodeMirror.e_stop(evt); XXX Not an event
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

    if (action === "open") {
      file_name_input = my_dialog.querySelector('input:checked');
      if (file_name_input) {
        file_name = file_name_input.nextSibling.textContent.split(" | ")[1].split("*")[0];
        active_cache = CodeMirror.menu_dict.active_cache || "textitor";
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
            my_gadget.property_dict.editor.setOption("mode", mime_type);
            editor_setActiveFile(file_name, mime_type);
            return RSVP.all([
              jIO.util.readBlobAsText(my_response_list[0]),
              jIO.util.readBlobAsText(my_response_list[1])
            ])
          })
          .push(function (my_read_response_list) {
            return editor_setFile(
              my_gadget,
              my_read_response_list,
              mime_type
            );
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

    if (action === "remove") {
      active_cache = CodeMirror.menu_dict.active_cache || "textitor";
      file_name_input = dialog_getTextInput(my_dialog, 0);
      file_name = file_name_input.value;
      
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
          return my_gadget.jio_removeAttachment(active_cache, file_name_input.value);
        })
        .push(function () {
          return true;
        })
        .push(null, function (my_error) {
          throw my_error;
        });
    }
    
    // save all and close = retrive what is in memory storage and save
    /*
    if (action === "saveall") {
      return new RSVP.Queue()
        .push(function () {
          return my_gadget.setActiveStorage("memory");
        })
        .push(function () {
          return my_gadget.jio_allDocs();
        })
        .push(function (my_storage_dict) {
          var response_dict = my_storage_dict.data,
            file_directory_list = [],
            len = response_dict.total_rows,
            i,
            cache_id;
          for (i = 0; i < len; i += 1) {
            cache_id = response_dict.rows[i].id;
            entry_dict[i] = {"name": cache_id, "item_list": []};
            directory_content_list.push(
              my_gadget.jio_allAttachments(cache_id)
            );
          }
          return RSVP.all(directory_content_list);  
        })
        .push(function (my_directory_content_list) {
          var len = my_directory_content_list.length,
            store_list = [],
            item,
            response,
            i;
          for (i = 0; i < len; i += 1) {
            response = my_directory_content[i];
              for (item in response) {
                if (response.hasOwnProperty(item)) {
                  // XXX
                  store_list.push(
                    new RSVP.Queue()
                      .push(function () {
                        return my_gadget.jio_getAttachment(entry_dict[i].name, item);
                      })
                      .push(function (my_document) {
                        var editor = my_document.getEditor()
                        return my_gadget.setActiveStorage("serviceworker");
                      })
                      .push(function() {
                        return my_gadget.jio_putAttachment(
                          cache_id,
                          item,
                          new Blob([editor.getValue()], {type: ""})
                        );
                      })
                      .push(function () {
                        return my_gadget.setActiveStorage("memory");
                      })
                      .push(function () {
                        return RSVP.all([
                          my_gadget.jio_removeAttachment(entry_dict[i].name, item),
                          my_gadget.jio_removeAttachment(entry_dict[i].name, item + "_history")
                        ]);
                      })
                      .push(null, function (my_error) {
                        throw my_error;
                      })
                  );
                }
              }
          }
          return RSVP.all(store_list);
        });
    }
    */
    
    // close file - store on memory when closing
    if (action === "close") {
      return new RSVP.Queue()
        .push(function () {
          dialog_clearTextInput(my_dialog);
          return editor_setFile(my_gadget);
        })
        .push(null, function (err) {
          console.log(err);
          throw err;
        })
    }

    // save file - store on cache, remove memory, close menu
    if (action === "save") {
      file_name_input = dialog_getTextInput(my_dialog, 0);
      mime_type_input = dialog_getTextInput(my_dialog, 1);
      is_cache_name = my_dialog.querySelector('input:checked');

      // validate
      if (!file_name_input.value) {
        return dialog_flagInput(file_name_input, 'Enter valid URL.');
      }
      if (!mime_type_input) {
        return dialog_flagInput(mime_type_input, 'Enter mime-type/cache name.');
      } else if (!is_validMimeType(mime_type_input.value) && !is_cache_name) {
        return dialog_flagInput(mime_type_input, 'Invalid/Unsupported mime-type');
      }

      active_cache = CodeMirror.menu_dict.active_cache || "textitor";
      mime_type = mime_type_input.value;
      file_name = file_name_input.value;

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
            new Blob([my_gadget.property_dict.editor.getValue()], {
              type: mime_type,
            })
          );
        })
        .push(function () {
          my_gadget.property_dict.editor.setOption("mode", mime_type);
          editor_setActiveFile(file_name, mime_type);
          CodeMirror.menu_dict.editor_resetModified();
          
          // close dialog
          return true;
        })
        .push(undefined, function (my_error) {
          console.log(my_error);
          throw my_error;
        });
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

  function dialog_getTextInput(my_dialog, my_index) {
    var text_input_list = [], 
      input_list,
      len,
      i;
    input_list = base_convertToArray(my_dialog.querySelectorAll("input"));
    for (i = 0, len = input_list.length; i < len; i += 1) {
      if (input_list[i].type === 'text') {
        text_input_list.push(input_list[i]);
      }
    }
    return text_input_list[my_index || 0];
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
          closed,
          text_input,
          my_context;

        my_context = my_context || this;
        my_option_dict = my_option_dict || {};
        dialog = setDialog(my_context, my_template, my_option_dict.bottom);
        closed = false;

        // evaluate state
        function dialog_evaluateState(my_parameter) {
          return new RSVP.Queue()
            .push(function () {
              if (closed !== true) {
                return dialog_updateStorage(my_gadget, dialog, my_parameter);
              }
              return my_parameter;
            })
            .push(function (my_close_dialog) {
              if (my_close_dialog === true) {
                closed = true;
                dialog.parentNode.removeChild(dialog);
                my_context.focus();
                CodeMirror.menu_dict.position = "idle";
        
                if (my_option_dict.onClose) {
                  my_option_dict.onClose(dialog);
                }
                // closing not saving, add to memory storage, always
                //if (my_option_dict.modified) {
                //  console.log("is modified")
                //}
                if (CodeMirror.menu_dict.digest_doc) {
                  return new RSVP.Queue()
                    .push(function () {
                      return my_gadget.setActiveStorage("memory");
                    })
                    .push(function () {
                      var menu = CodeMirror.menu_dict,
                        doc = menu.digest_doc,
                        active_storage = menu.active_cache || "textitor",
                        active_file = menu.active_file;

                      // need to store the history separately, can't store full doc
                      return RSVP.all([
                        my_gadget.jio_putAttachment(
                          active_storage,
                          active_file.name, 
                          new Blob([doc.getValue()], {type: active_file.mime_type})
                        ),
                        my_gadget.jio_putAttachment(
                          active_storage,
                          active_file.name + "_history",
                          new Blob([JSON.stringify(doc.getHistory())], {
                            'type': "application/json"
                          })
                        )
                      ]);
                    })
                    .push(function () {
                      CodeMirror.menu_dict.digest_doc = null;
                      editor_resetActiveFile();
                    })
                    .push(null, function (err) {
                      console.log(err);
                      throw err;
                    })
                }
              }
            });
        }

        CodeMirror.menu_dict.evaluateState = dialog_evaluateState;
        
        function dialog_updateFileMenu(my_parameter) {
          return setFileMenuItem(dialog, my_parameter);
        }
        
        CodeMirror.menu_dict.updateFileMenu = dialog_updateFileMenu;
  
        text_input = dialog_getTextInput(dialog);
        if (text_input) {
          text_input.focus();
          
          if (my_option_dict.value) {
            text_input.value = my_option_dict.value;
            if (my_option_dict.selectValueOnOpen !== false) {
              text_input.select();
            }
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

    // esc
    if (my_event.keyCode === 27) {
      CodeMirror.commands.myEditor_closeDialog(my_event);
    }

    // ovrride chrome page start/end shortcut
    if (my_event.keyCode === 35) {
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
        case 67: return Codemirror.commands.myEditor_closeFile();   // (c)lose file
        case 79: return Codemirror.commands.myEditor_openFromDialog(); // (o)pen
        case 83: return CodeMirror.commands.myEditor_saveFromDialog(); // (s)ave
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

  function editor_setFile(my_gadget, my_content, my_mime_type) {
    var new_doc,
      old_doc;
    
    function local_returnResult(my_jio_response) {
      return my_jio_response.target.result;
    }

    if (my_content) {
      new_doc = CodeMirror.Doc(local_returnResult(my_content[0]), my_mime_type);
      if (local_returnResult(my_content[1])) {
        new_doc.setHistory(JSON.parse(local_returnResult(my_content[1])));
      }
    } else {
      new_doc = CodeMirror.Doc("");
    }

    old_doc = my_gadget.property_dict.editor.swapDoc(new_doc);
    if (old_doc.getValue() !== "") {
      CodeMirror.menu_dict.digest_doc = old_doc;
    }
    CodeMirror.menu_dict.editor_resetModified();
    return true;
  }

  function editor_setActiveFile(my_name, my_mime_type) {
    CodeMirror.menu_dict.active_file = {
      "name": my_name,
      "mime_type": my_mime_type
    };
  }
  function editor_resetActiveFile() {
    CodeMirror.menu_dict.active_file = {};
  }
  function editor_getActiveFile() {
    var active_file = CodeMirror.menu_dict.active_file;
    return [active_file.name || "", active_file.mime_type || ""];
  }

  // shortcut handlers
  function editor_closeFile() {
    return CodeMirror.menu_dict.evaluateState({"target":{"name": "close"}});
  }
  CodeMirror.commands.myEditor_closeFile = editor_closeFile;
  
  function editor_closeDialog(my_event) {
    if (CodeMirror.menu_dict.evaluateState) {
      CodeMirror.menu_dict.evaluateState();
    }
  }
  CodeMirror.commands.myEditor_closeDialog = editor_closeDialog;

  function editor_saveFromDialog() {
    if (CodeMirror.menu_dict.position === "right") {
      return CodeMirror.menu_dict.evaluateState({"target":{"name": "save"}});
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

  // XXX remove
  var editorURI;
  var editorTextarea;
  var editor;
  var commands = {};

  
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
  // XXX remove

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

      // XXX remove
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
      // XXX remove

      return dialog_setDialogExtension(my_gadget);
    })

    /////////////////////////////
    // declared methods
    /////////////////////////////
    .declareMethod('render', function (my_option_dict) {
      var gadget = this,
        dict = gadget.property_dict;

      CodeMirror.lint["application/javascript"] = CodeMirror.lint.javascript;
      CodeMirror.lint["application/json"] = CodeMirror.lint.json;
      CodeMirror.lint["text/css"] = CodeMirror.lint.css;
      CodeMirror.menu_dict.editor_setModified = function () {
        if (dict.modified !== true) {
          dict.modified = true;
          dict.element.querySelector(".CodeMirror").className += 
            " custom-set-modified";
        }
      };
      
      CodeMirror.menu_dict.editor_resetModified = function () {
        var element = dict.element.querySelector(".CodeMirror");
        dict.modified = null;
        element.className = element.className
          .split("custom-set-modified").join("");
      };
    
      // http://codemirror.net/doc/manual.html#config
      editor = CodeMirror.fromTextArea(dict.textarea, {
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

      dict.editor = editor;

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

