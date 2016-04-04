/*jslint indent: 2, vars: true, nomen: true, maxerr: 3 */
/*global window, rJS, document, location, alert, prompt, confirm, setTimeout,
  toolbox, CodeMirror */

  /* Codemirror Extension/Overwrites */
  function dialogDiv(my_context, my_template, my_bottom) {
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

  function closeNotification(my_context, my_newVal) {
    if (my_context.state.currentNotificationClose) {
      my_context.state.currentNotificationClose();
    }
    my_context.state.currentNotificationClose = my_newVal;
  }
  
  // overwrite openDialog
  function setOpenDialog() {
    return CodeMirror.defineExtension("openDialog", function(my_template, my_callback, my_option_dict) {
      var closing_event_list = [],
        recurring_event_list = [],
        event_list = [],
        dialog,
        closed,
        inp,
        button,
        action_form,
        my_context;

      my_context = my_context || this;
      my_option_dict = my_option_dict || {};
      dialog = dialogDiv(my_context, my_template, my_option_dict.bottom);
      closed = false;
      action_form = dialog.querySelector("form");

      //
      function close(my_newVal) {
        console.log("CLOSING");
        console.log(my_newVal);
        if (typeof my_newVal == 'string') {
          inp.value = my_newVal;
        } else {
          if (closed) {
            return;
          }
          
          closed = true;
          dialog.parentNode.removeChild(dialog);
          my_context.focus();
  
          if (my_option_dict.onClose) {
            my_option_dict.onClose(dialog);
          }
        }
      }

      inp = dialog.getElementsByTagName("input")[0];
      if (inp) {
        if (my_option_dict.value) {
          inp.value = my_option_dict.value;
          if (my_option_dict.selectValueOnOpen !== false) {
            inp.select();
          }
        }


        // NOTE: bind via RSVP vs CodeMirror breaks browser compat
        if (my_option_dict.onInput) {
          event_list.push(
            loopEventListener(inp, "input", false, function (my_event) {
              my_option_dict.onInput(my_event, inp.value, close);
            })
          );
        }

        if (my_option_dict.onKeyUp) {
          event_list.push(
            loopEventListener(inp, "keyup", false, function (my_event) {
              my_option_dict.onKeyUp(my_event, inp.value, close);
            })
          );
        }
        
        // default onkeydown, won't be used
        /*
        // if (my_option_dict && my_option_dict.onKeyDown) {
          event_list.push(
            loopEventListener(inp, "keydown", false, function (my_event) {
              my_option_dict.onKeyDown(my_event, inp.value, close);
          })
        );
        //}
        */
        

        closing_event_list.push(
          loopEventListener(inp, "keydown", false, function (my_event) {
            console.log("keydown close triggered");
            // close on ESC only
            // (my_option_dict.closeOnEnter !== false && my_event.keyCode == 13)
            if (my_event.keyCode == 27) {
              inp.blur();
              CodeMirror.e_stop(my_event);
              return close();
            }

            // closing callback necessary?
            //if (my_event.keyCode == 13) {
            //  return my_callback(inp.value, my_event);
            //}    
          })
        );
      }

      // won't apply - still...
      if (my_option_dict.closeOnBlur !== false) {
        closing_event_list.push(
          new RSVP.Queue()
            .push(function () {
              return promiseEventListener(inp, "blur", false);
            })
            .push(function (my_event) {
              close(my_event);
            })
          );
      }
      inp.focus();

      if (action_form) {
        //recurring_event_list.push(
          var baz = loopEventListener(
            action_form,
            "submit",
            false, 
            function (my_event) {
              var target = my_event.target,
                action = target.submit.name;
            }
          )
        // );
      }

      // gogo-gadget-oh rsvp...
      return new RSVP.Queue()
        .push(function () {
          closeNotification(my_context, null);

          return RSVP.any(
            RSVP.all(event_list),
            RSVP.any(closing_event_list)
          );
        })
        .push(function (my_return_close) {
          return close;
        });

    });
  }
      

  /* Keymap */
  CodeMirror.keyMap.my = {"fallthrough": "default"};

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
  
  var OBJECT_MENU = "<span>Name:</span><input type=\"text\" value=\"\" />" +
    "<span class='custom-menu-typewriter'>CTRL+ALT+</span>" +
    "<form name='save'><button type='submit' class='custom-menu-button'><b>S</b>ave</button></form>" +
    "<form name='close'><button type='submit' class='custom-menu-button'><b>C</b>lose</button></form>" +
    "<form name='remove'><button type='submit' class='custom-menu-button'><b>D</b>elete</button></form>";
  
  var OBJECT_LIST_MENU = "<span>Search:</span><input type=\"text\" value=\"\" />" +
    "<span class='custom-menu-typewriter'>CTRL+ALT+</span>" +
    "<form name='search'><button type='submit' class='custom-menu-button'><b>F</b>ind</button></form>";

  CodeMirror.navigationMenu = {"position": "idle"};
  
  function setNavigationMenu(my_direction) {
    switch (CodeMirror.navigationMenu.position) {
      case "idle":
        CodeMirror.navigationMenu.position = my_direction;
        if (my_direction === "right") {
          return OBJECT_MENU;
        }
        return OBJECT_LIST_MENU;
      case "left":
        if (my_direction === "left") {
          return OBJECT_LIST_MENU;
        }
        CodeMirror.navigationMenu.position = "idle";
        return;
      case "right":
        if (my_direction === "left") {
          CodeMirror.navigationMenu.position = "idle";
          return;
        }
        return OBJECT_LIST_MENU;
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

  function enterCallback(my_selected_value, my_event) {
    return;
  }
  
  // http://codemirror.net/doc/manual.html#addon_dialog
  function navigateRight(cm) {
    
    var menu = setNavigationMenu("right");
    if (menu === undefined) {
      // need to close
    }
    if (cm.openDialog) {
      cm.openDialog(
        menu,
        enterCallback,
        {
          "bottom": false,
          "closeOnEnter": false,
          "closeOnBlur": false,
          "value": null,
          "selectValueOnOpen": false,
          "onKeyUp": function (e, val, close) {
            setNavigationCallback(e, val, close);
            return true;
          },
          // "onClose": function () {},
          "onInput": function (e, val, close) {
            console.log("INPUT");
            console.log(e);
            console.log(val);
          }
        }
      );
    }
  }
  CodeMirror.commands.myNavigateRight = navigateRight;

  function navigateLeft(cm) {
    var menu = setNavigationMenu("left");
    if (menu !== undefined) {
      // need to close
    }
    if (cm.openDialog) {
      cm.openDialog(menu, enterCallback, {
        "bottom": false,
        "closeOnEnter": false,
        "closeOnBlur": false,
        "value": null,
        "selectValueOnOpen": false,
        "onKeyUp": function (e, val, close) {
          setNavigationCallback(e, val, close);
          return true;
        },
        "onInput": function (e, val, close) {
          
        }
      });
    }
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

      // overwrite dialog
      setOpenDialog();

      //////////
      // Init //
      //////////
      editorURI = my_gadget.property_dict.uri || window.location.hash.slice(1);
      if (my_gadget.property_dict.textarea) {
        editorTextarea = my_gadget.property_dict.textarea;
      } else {
        editorTextarea = document.createElement("textarea");
        my_gadget.property_dict.textarea = editorTextarea;
        my_gadget.property_dict.element.appendChild(editorTextarea);
      }
    
      //////////////////
      // Set commands //
      //////////////////
    
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


    })

    .declareMethod('render', function (my_option_dict) {
      var gadget = this;
      
      /////////////////
      // Init editor //
      /////////////////
    
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
    
    .declareService(function () {
      var exec_queue = new RSVP.Queue();

      window.editor.refresh();
      window.editor.focus();
      
      exec_queue.push(function () {
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

      return exec_queue;
    });

}(window, rJS));
