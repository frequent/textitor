/*jslint indent: 2, vars: true, nomen: true, maxerr: 3 */
/*global window, rJS, document, location, alert, prompt, confirm, setTimeout,
  toolbox, CodeMirror */

  /*! Copyright (c) 2015 Tristan Cavelier <t.cavelier@free.fr>
  This program is free software. It comes without any warranty, to
  the extent permitted by applicable law. You can redistribute it
  and/or modify it under the terms of the Do What The Fuck You Want
  To Public License, Version 2, as published by Sam Hocevar. See
  http://www.wtfpl.net/ for more details. */

  var originalPageTitle = document.title;
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

  function generateTitleFromURI(uri) {
    /*jslint regexp: true */
    return uri.replace(/^([a-z]+:)?((?:[^\/]*\/)*)([^\/]*)$/, function (match, protocol, dirname, basename) {
      /*jslint unparam: true */
      if (basename) {
        return basename + " (" + (protocol || "") + dirname + ") - " + originalPageTitle;
      }
      return (protocol || "") + dirname + " - " + originalPageTitle;
    });
  }

  function md5sumArrayBuffer(message) {
    // @param  {ArrayBuffer} message
    // @return {ArrayBuffer} hash
    // Info: Uint32Array endianness is always little-endian in javascript

    function leftrotate(num, cnt) {
      return (num << cnt) | (num >>> (32 - cnt));
    }
    function memcpy(src, dst, srci, dsti, len) {
      while (len > 0) {
        dst[dsti] = src[srci];
        srci += 1;
        dsti += 1;
        len -= 1;
      }
    }
    /*jslint bitwise: true */
    /*global Uint8Array, Uint32Array */
    var mod, padding2,
      hash = new Uint32Array(4),
      padding = new Uint8Array(64),
      M = new Uint32Array(16),
      bl = message.byteLength,
      s = [
        7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,
        5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,
        4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,
        6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21
      ],
      K = [
        0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
        0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
        0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
        0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
        0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
        0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
        0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
        0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
        0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
        0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
        0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
        0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
        0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
        0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
        0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
        0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
      ];
    memcpy([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476], hash, 0, 0, 4);
    message = new Uint8Array(message);

    padding = new Uint32Array(padding.buffer);
    padding[14] = bl * 8;
    padding[15] = bl * 8 / 0x100000000;
    padding = new Uint8Array(padding.buffer);

    mod = bl % 64;
    if (mod) {
      bl -= mod;
      if (mod > 56) {
        padding2 = new Uint8Array(64);
        memcpy(message, padding2, bl, 0, mod);
        padding2[mod] = 0x80;
      } else {
        memcpy(message, padding, bl, 0, mod);
        padding[mod] = 0x80;
      }
    } else {
      padding[0] = 0x80;
    }
    function blk(A, i, hash) {
      /*jslint bitwise: true */
      var a = hash[0], b = hash[1], c = hash[2], d =  hash[3], f = 0, g = 0, tmp = 0;
      M[0] = A[i] + A[i + 1] * 0x100 + A[i + 2] * 0x10000 + A[i + 3] * 0x1000000;
      i += 4;
      while (i % 64) {
        M[(i % 64) / 4] = A[i] + A[i + 1] * 0x100 + A[i + 2] * 0x10000 + A[i + 3] * 0x1000000;
        i += 4;
      }
      i = 0;
      while (i < 64) {
        if (i < 16) {
          f = (b & c) | ((~b) & d);
          g = i;
        } else if (i < 32) {
          f = (d & b) | ((~d) & c);
          g = (5 * i + 1) % 16;
        } else if (i < 48) {
          f = b ^ c ^ d;
          g = (3 * i + 5) % 16;
        } else {
          f = c ^ (b | (~d));
          g = (7 * i) % 16;
        }
        tmp = d;
        d = c;
        c = b;
        b = b + leftrotate((a + f + K[i] + M[g]), s[i]);
        a = tmp;
        i += 1;
      }
      hash[0] = hash[0] + a;
      hash[1] = hash[1] + b;
      hash[2] = hash[2] + c;
      hash[3] = hash[3] + d;
    }
    mod = 0;
    while (mod < bl) {
      blk(message, mod, hash);
      mod += 64;
    }
    if (padding2) { blk(padding2, 0, hash); }
    blk(padding, 0, hash);
    return hash.buffer;
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
      commands["open doc"] = "Loads and edit an URI data.";
      commands.open = function (cm, args) {
        if (cm.getOption("readOnly")) {
          alert("Cannot open any resource right now. Please try later.");
          return;
        }
        cm.off("change", setModified);
        cm.setOption("readOnly", true);
        if (!args[1]) { args[1] = prompt("Open URI:", editorURI); }
        if (!args[1]) {
          cm.setOption("readOnly", false);
          return alert("Empty URI, aborting.");
        }
        document.title = "Loading... " + generateTitleFromURI(args[1]);
        var mimetype;
        return ecc.getURI(args[1]).then(function (blob) {
          mimetype = blob.type;
          return blob;
        }).toText().catch(function (reason) {
          if (reason && reason.status === 404) {
            if (confirm("URI not found, would you like to edit it anyway?")) {
              return "";
            }
          }
          return Promise.reject(reason);
        }).then(function (text) {
          editorURI = args[1];
          location.hash = "#" + args[1];
          cm.setValue(text);
          cm.setOption("mode", mimetype || "text");
          cm.modified = false;
          document.title = generateTitleFromURI(editorURI);
        }).catch(alert).then(function () {
          cm.setOption("readOnly", false);
          cm.on("change", setModified);
        });
      };
      commands["saveAs doc"] = "Save the current data to another URI.";
      commands.saveAs = function (cm, args) {
        if (cm.getOption("readOnly")) {
          alert("Cannot save resource right now. Please try later.");
          return;
        }
        cm.setOption("readOnly", true);
        if (!args[1]) { args[1] = prompt("Save as URI:", editorURI); }
        if (!args[1]) {
          cm.setOption("readOnly", false);
          return alert("Empty URI, aborting.");
        }
        document.title = "Saving... " + generateTitleFromURI(args[1]);
        return ecc.value(cm.getValue()).putURI(args[1]).then(function () {
          editorURI = args[1];
          location.hash = "#" + args[1];
          editor.modified = false;
        }).catch(alert).then(function () {
          document.title = generateTitleFromURI(editorURI);
          cm.setOption("readOnly", false);
        });
      };
      commands["save doc"] = "Save the current data to the current URI.";
      commands.save = function (cm) {
        return commands.saveAs(cm, ["save", editorURI]);
      };
      commands["download doc"] = "Open download pop-up.";
      commands.download = function (cm) {
        var filename = prompt("Filename:");
        if (!filename) { return alert("Empty filename, aborting."); }
        toolbox.downloadAs(filename, cm.getValue(), "application/octet-stream");
      };
      commands["mode doc"] = "{javascript|html|python|...}";
      commands.mode = function (cm, args) {
        cm.setOption("mode", modeShortcuts[args[1]] || args[1]);
        cm.setOption("lint", false);
        if (cm.getOption("krxAutoLint") && CodeMirror.lint[cm.getOption("mode")]) {
          setTimeout(function () { cm.setOption("lint", true); });
        }
      };
      commands["lint doc"] = "Toggle automatic lint";
      commands.lint = function (cm) {
        if (cm.getOption("lint")) {
          cm.setOption("krxAutoLint", false);
          cm.setOption("lint", false);
        } else if (CodeMirror.lint[cm.getOption("mode")]) {
          cm.setOption("krxAutoLint", true);
          cm.setOption("lint", true);
        }
      };
      commands["keyMap doc"] = "{default|krx|emacs|vim}";
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
      commands["tab-size doc"] = "Set tab-size (int).";
      commands["tab-size"] = function (cm, args) {
        var i = parseInt(args[1], 10);
        if (isFinite(i)) {
          cm.setOption("tabSize", i);
        }
      };
      /*jslint evil: true */
      commands["eval doc"] = "Eval entire text as javascript /!\\ POTENTIALY DANGEROUS";
      commands.eval = function (cm) {
        window.eval(cm.getValue());
      };
      /*jslint evil: false */
      commands["md5 doc"] = "Summarise the document content";
      commands.md5 = function (cm) {
        prompt("MD5", [].reduce.call(new Uint8Array(md5sumArrayBuffer(toolbox.textToArrayBuffer(cm.getValue()))), function (p, v) {
          return p + ("0" + v.toString(16)).slice(-2);
        }, ""));
      };
    
      /*
        "remove-trailing-spaces": function (cm) {
          var position = cm.getCursor();
          cm.setValue(cm.getValue().replace(/[ \t]+(\r)?\n/g, '$1\n'));
          cm.setCursor(position);
        },
        "view-as-svg": function (cm) {
          var svg_update_ident, svg_img = root.document.createElement("img");
          root.document.body.appendChild(svg_img);
          cm.setOption("fullScreen", false);
          function updateSvg() {
            svg_img.setAttribute(
              "src",
              "data:image/svg+xml;base64," + btoa(toolbox.stringToBinaryString(cm.getValue())
            );
          }
          cm.on("change", function () {
            root.clearTimeout(svg_update_ident);
            svg_update_ident = root.setTimeout(updateSvg, 200);
          });
          updateSvg();
        }
        */

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
    
        keyMap: "krx", // default "default"
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
        krxAutoLint: true,
    
        autofocus: true, // default false
        theme: "rubyblue", // default "default"
        mode: "text"
      });

    
      if (location.hash) {
        commands.open(editor, ["open", location.hash.slice(1)]);
      }
    
      window.editor = editor;
    
      //////////////////////
      // Add gist feature //
      //////////////////////

      // try to save to "data:"
      toolbox.ExtendedCancellableChain.prototype.putDataURI = function () {
        var editorMode = editor.getOption("mode") || "text/plain", mimetype = toolbox.parseContentType(editorMode);
        if (mimetype.match === mimetype.input) {
          mimetype = editorMode;
        } else {
          mimetype = modeMimes[editorMode] || "text/plain";
        }
        this.toDataURI(mimetype).then(function (dataURI) {
          location.hash = "#" + dataURI;
        });
        return;
      };
      
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
