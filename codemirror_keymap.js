/*jslint indent: 2 */
(function (root) {
  "use strict";

  /*
   A stateless keymap that mix some emacs and vim shortcuts
   mostly thank to the Alt button.
  */

  /*! Copyright (c) 2015-2016 Tristan Cavelier <t.cavelier@free.fr>
      This program is free software. It comes without any warranty, to
      the extent permitted by applicable law. You can redistribute it
      and/or modify it under the terms of the Do What The Fuck You Want
      To Public License, Version 2, as published by Sam Hocevar. See
      http://www.wtfpl.net/ for more details. */

  /*jslint vars: true */

  var CodeMirror = root.CodeMirror;

  function update(object1, object2) {
    /*jslint forin: true */
    var key;
    for (key in object2) {
      object1[key] = object2[key];
    }
    return object1;
  }

  function defaults(object1, object2) {
    /*jslint forin: true */
    var key;
    for (key in object2) {
      if (object1[key] === undefined) {
        object1[key] = object2[key];
      }
    }
    return object1;
  }

//   function addNTimes(toAdd, n) {
//     var i, res;
//     if (typeof toAdd === "string") {
//       res = "";
//     } else if (typeof toAdd === "number") {
//       res = 0;
//     }
//     for (i = 0; i < n; i += 1) {
//       res += toAdd;
//     }
//     return res;
//   }
//
//   function operateOnLine(cm, op) {
//     var start = defaults({"ch": 0}, cm.getCursor()), end = defaults({}, start);
//     end.line += 1;
//     cm.replaceRange(op(cm.getRange(start, end)), start, end);
//     cm.setCursor(end);
//   }

  // Vocabulary:
  // - Right: from the cursor, match the next on the document, until the end of document
  // - After: from the cursor, match the next on the line, until the end of line. If cursor is on eol, then match also on the next line
  // - Left: from the cursor, match the previous on the document, until the beginning of document
  // - Before: from the cursor, match the previous on the line, until the beginning of line. If cursor is on bol, then match also on the previous line

  function operateUntilWordAfter(cm, op) {
    var start = cm.getCursor(), end = cm.findPosH(start, 1, "word");
    cm.replaceRange(op(cm.getRange(start, end)), start, end);
    cm.setCursor(end);
  }

  function operateOnCharAfter(cm, op) {
    var start = cm.getCursor(), end = cm.findPosH(start, 1, "char");
    cm.replaceRange(op(cm.getRange(start, end)), start, end);
    cm.setCursor(end);
  }

  function capitalize(string) {
    return string.replace(/\w+/g, function (word) {
      return word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase();
    });
  }

  function reverseCase(string) {
    var i, l, str = "", chr;
    for (i = 0, l = string.length; i < l; i += 1) {
      chr = string[i].toUpperCase();
      if (chr !== string[i]) {
        str += chr;
        continue;
      }
      chr = string[i].toLowerCase();
      str += chr;
    }
    return str;
  }

  function setOrUnsetMark(cm) {
    cm.setCursor(cm.getCursor());
    cm.setExtending(!cm.getExtending());
    function setExtendingToFalse() {
      cm.off("change", setExtendingToFalse);
      cm.setExtending(false);
    }
    cm.on("change", setExtendingToFalse);
  }

  function convertSelectionToSquareSelection(cm) {
    var anchor = cm.getCursor("from"), head = cm.getCursor("to"), leftCh = (anchor.ch < head.ch ? anchor.ch : head.ch), i;
    cm.setSelection(anchor, {line: anchor.line, ch: head.ch});
    if (anchor.line < head.line) {
      for (i = anchor.line + 1; i <= head.line; i += 1) {
        if (cm.getLine(i).length >= leftCh) {
          cm.addSelection({line: i, ch: anchor.ch}, {line: i, ch: head.ch});          
        }
      }
    } else {
      for (i = anchor.line - 1; i >= head.line; i -= 1) {
        if (cm.getLine(i).length >= leftCh) {
          cm.addSelection({line: i, ch: anchor.ch}, {line: i, ch: head.ch});          
        }
      }
    }
    //cm.setExtending(false);
  }
  CodeMirror.commands.krxConvertSelectionToSquareSelection = convertSelectionToSquareSelection;

  function clearMark(cm) {
    cm.setExtending(false);
    cm.setCursor(cm.getCursor());
  }

  // TODO moveBlockOrLineUp
  function moveLineUp(cm) {
    var cursor = cm.getCursor(), lineUp, lineDown;
    lineUp = cm.getRange({"line": cursor.line - 1, "ch": 0}, {"line": cursor.line, "ch": 0});
    if (lineUp === "") { return; }
    lineDown = cm.getRange({"line": cursor.line, "ch": 0}, {"line": cursor.line + 1, "ch": 0});
    if (lineDown[lineDown.length - 1] !== "\n") {
      lineUp = lineUp.slice(0, -1);
      lineDown += "\n";
    }
    cm.replaceRange(lineDown + lineUp, {"line": cursor.line - 1, "ch": 0}, {"line": cursor.line + 1, "ch": 0});
    cm.setCursor({"line": cursor.line - 1, "ch": cursor.ch});
  }

  // TODO moveBlockOrLineDown
  function moveLineDown(cm) {
    var cursor = cm.getCursor(), lineUp, lineDown;
    lineUp = cm.getRange({"line": cursor.line, "ch": 0}, {"line": cursor.line + 1, "ch": 0});
    if (lineUp[lineUp.length - 1] !== "\n") { return; }
    lineDown = cm.getRange({"line": cursor.line + 1, "ch": 0}, {"line": cursor.line + 2, "ch": 0});
    if (lineDown[lineDown.length - 1] !== "\n") {
      lineUp = lineUp.slice(0, -1);
      lineDown += "\n";
    }
    cm.replaceRange(lineDown + lineUp, {"line": cursor.line, "ch": 0}, {"line": cursor.line + 2, "ch": 0});
    cm.setCursor({"line": cursor.line + 1, "ch": cursor.ch});
  }

  function transposeWords(cm) {
    // TODO does not work with "  function transposeWords(cm) {" with cursor between "transposeWords" and "cm", and also between "cm" and the end of the line
    var wordOneStart, wordOneEnd, wordTwoStart, wordTwoEnd, wordOne, wordTwo, offset;
    wordOneStart = cm.findPosH(cm.getCursor(), -1, "word");
    wordOneEnd = cm.findPosH(wordOneStart, 1, "word");
    wordTwoEnd = cm.findPosH(wordOneEnd, 1, "word");
    wordTwoStart = cm.findPosH(wordTwoEnd, -1, "word");
    wordOne = cm.getRange(wordOneStart, wordOneEnd);
    wordTwo = cm.getRange(wordTwoStart, wordTwoEnd);
    console.log(wordOne);
    console.log(wordTwo);
    offset = wordTwo.length - wordOne.length;
    cm.replaceRange(wordTwo, wordOneStart, wordOneEnd);
    cm.replaceRange(wordOne, cm.findPosH(wordTwoStart, offset, "char"), cm.findPosH(wordTwoEnd, offset, "char"));
    cm.setCursor(wordTwoEnd);
  }

  function removeSpacesAtCursor(cm) {
    if (cm.getOption("readOnly")) { return; }
    var cursor, col;
    while (true) {
      cursor = cm.getCursor();
      col = cm.findPosH(cursor, -1, "column");
      if (/\s/.test(cm.getRange(col, cursor))) {
        cm.replaceRange("", col, cursor);
      } else {
        break;
      }
    }
    while (true) {
      cursor = cm.getCursor();
      col = cm.findPosH(cursor, 1, "column");
      if (/\s/.test(cm.getRange(cursor, col))) {
        cm.replaceRange("", cursor, col);
      } else {
        break;
      }
    }
  }
  CodeMirror.commands.krxRemoveSpacesAtCursor = removeSpacesAtCursor;

  function autocompleteWordOnChangeListener(cm) {
    cm.off("change", autocompleteWordOnChangeListener);
    delete cm.krxAutocompleteWordVars;
  }
  function autocompleteWord(cm, reverse) {
    var vars = cm.krxAutocompleteWordVars, cursor = cm.getCursor(), wordsDict = {}, words, index, firstText, lastText, wordPart, re;
    function add(word) {
      delete wordsDict[word];
      wordsDict[word] = null;
      return word;
    }

    if (vars && vars.location && vars.location.line === cursor.line && vars.location.ch === cursor.ch && vars.words && cm.getLine(cursor.line).slice(0, cursor.ch).endsWith(vars.words[vars.index || 0])) {
      // go to next index
      index = vars.index;
      if (reverse) {
        if (index < vars.words.length - 1) { index += 1; } else { index = 0; }
      } else {
        if (index > 0) { index -= 1; } else { index = vars.words.length - 1; }
      }
      cm.off("change", autocompleteWordOnChangeListener);
      cm.replaceRange(vars.words[index], {line: cursor.line, ch: cursor.ch - vars.words[vars.index].length}, cursor);
      vars.location = {line: cursor.line, ch: cursor.ch - vars.words[vars.index].length + vars.words[index].length};
      vars.index = index;
      cm.on("change", autocompleteWordOnChangeListener);
    } else {
      // store words and go to first index
      firstText = cm.getRange({"line": 0, "ch": 0}, cursor).replace(/\w+$/, function (match) { wordPart = match; return ""; });
      if (!wordPart) { return; }
      lastText = cm.getValue().slice(firstText.length).replace(/^\w+/, "");
      re = new RegExp("\\b" + wordPart + "\\w+", "g");
      lastText.replace(re, add);
      firstText.replace(re, add);
      words = Object.keys(wordsDict);
      if (!words.length) { return; }
      if (reverse) {
        index = 0;
      } else {
        index = words.length - 1;
      }
      wordPart = words[index].slice(wordPart.length);
      cm.off("change", autocompleteWordOnChangeListener);
      cm.replaceRange(wordPart, cursor, cursor);
      cursor.ch += wordPart.length;
      cm.krxAutocompleteWordVars = {
        location: cursor,
        words: words,
        index: index
      };
      cm.on("change", autocompleteWordOnChangeListener);
    }
  }
  CodeMirror.commands.krxAutocompleteWord = autocompleteWord;
  CodeMirror.commands.krxAutocompleteWordReverse = function (cm) { return autocompleteWord(cm, true); };

  function insertNewline(cm) { cm.replaceSelection("\n"); }
  CodeMirror.commands.krxInsertNewline = insertNewline;
  function doNothing() { return; }
  CodeMirror.commands.krxDoNothing = doNothing;

  // keymap samples emacs-Ctrl-X {"auto": "emacs", "nofallthrough": true, "disableInput": true}
  //                emacs-Ctrl-Q {"auto": "emacs", "nofallthrough": true}

  // CodeMirror.keyMap.krx = updateObject({}, CodeMirror.keyMap["default"]);
  CodeMirror.keyMap.krx = {"fallthrough": "default"};
  CodeMirror.keyMap.krx.Enter = insertNewline;
  CodeMirror.keyMap.krx.Tab = "insertSoftTab";
  CodeMirror.keyMap.krx.F3 = "findNext";

  CodeMirror.keyMap.krx["Alt-A"] = "goLineEnd";
  CodeMirror.keyMap.krx["Alt-B"] = "goGroupLeft";
  CodeMirror.keyMap.krx["Alt-C"] = function (cm) {
    operateOnCharAfter(cm, reverseCase);
  };
  CodeMirror.keyMap.krx["Alt-D"] = "delWordAfter"; // "duplicateLine";
  CodeMirror.keyMap.krx["Alt-E"] = "goGroupRight";
  CodeMirror.keyMap.krx["Alt-F"] = doNothing;
  CodeMirror.keyMap.krx["Alt-G"] = function (cm) {
    var line = root.prompt("Go to line:"), cursor;
    if (line) {
      line = parseInt(line, 10);
      if (isFinite(line)) {
        cursor = cm.getCursor();
        cursor.line = line - 1;
        cm.setCursor(cursor);
      }
    }
  };
  CodeMirror.keyMap.krx["Alt-H"] = "goCharLeft"; // "goColumnLeft";
  CodeMirror.keyMap.krx["Alt-I"] = "indentAuto";
  CodeMirror.keyMap.krx["Alt-J"] = "goLineDown";
  CodeMirror.keyMap.krx["Alt-K"] = "goLineUp";
  CodeMirror.keyMap.krx["Alt-L"] = "goCharRight"; // "goColumnRight";
  CodeMirror.keyMap.krx["Alt-M"] = insertNewline; // "goLineStartSmart";
  CodeMirror.keyMap.krx["Alt-N"] = "findNext";
  CodeMirror.keyMap.krx["Alt-O"] = function (cm) {
    cm.execCommand("goLineEnd");
    cm.replaceSelection("\n");
  };
  CodeMirror.keyMap.krx["Alt-P"] = doNothing; // TODO searchPrevious
  // CodeMirror.keyMap.krx["Alt-Q"] = undefined;
  CodeMirror.keyMap.krx["Alt-R"] = "replace";
  CodeMirror.keyMap.krx["Alt-S"] = "delWordBefore";
  CodeMirror.keyMap.krx["Alt-T"] = "transposeChars";
  CodeMirror.keyMap.krx["Alt-U"] = "undo";
  CodeMirror.keyMap.krx["Alt-V"] = setOrUnsetMark;
  CodeMirror.keyMap.krx["Alt-W"] = "goWordRight";
  CodeMirror.keyMap.krx["Alt-X"] = "delCharAfter";
  CodeMirror.keyMap.krx["Alt-Y"] = "duplicateLine";
  // CodeMirror.keyMap.krx["Alt-Z"] = undefined;
  CodeMirror.keyMap.krx["Alt-0"] = "goLineStart";
  CodeMirror.keyMap.krx["Alt-/"] = "find";
  CodeMirror.keyMap.krx["Alt-\\"] = "krxRemoveSpacesAtCursor";
  CodeMirror.keyMap.krx["Alt-#"] = "krxRemoveSpacesAtCursor";
  CodeMirror.keyMap.krx["Alt--"] = "krxAutocompleteWord";
  CodeMirror.keyMap.krx["Alt-Up"] = "goPageUp"; // (NO OTHER CHOICE on chromebooks)
  CodeMirror.keyMap.krx["Alt-Down"] = "goPageDown"; // (NO OTHER CHOICE on chromebooks)
  CodeMirror.keyMap.krx["Alt-Space"] = "krxAutocompleteWord"; // (unreachable on Windows)
  CodeMirror.keyMap.krx["Alt-Backspace"] = "delCharAfter"; // (NO OTHER CHOICE on chromebooks)
  CodeMirror.keyMap.krx["Alt-Enter"] = function (cm) {
    cm.execCommand("krxRemoveSpacesAtCursor");
    cm.execCommand("newlineAndIndent");
  };

  // CodeMirror.keyMap.krx["Ctrl-A"] = undefined;
  CodeMirror.keyMap.krx["Ctrl-B"] = doNothing;
  // CodeMirror.keyMap.krx["Ctrl-C"] = undefined;
  CodeMirror.keyMap.krx["Ctrl-D"] = "delCharAfter";
  // CodeMirror.keyMap.krx["Ctrl-E"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-F"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-G"] = undefined;
  CodeMirror.keyMap.krx["Ctrl-H"] = "delCharBefore";
  CodeMirror.keyMap.krx["Ctrl-I"] = "insertTab";
  CodeMirror.keyMap.krx["Ctrl-J"] = insertNewline;
  // CodeMirror.keyMap.krx["Ctrl-K"] = "goLineUp";
  // CodeMirror.keyMap.krx["Ctrl-L"] = "goCharRight";
  CodeMirror.keyMap.krx["Ctrl-M"] = insertNewline;
  // CodeMirror.keyMap.krx["Ctrl-N"] = undefined; // (browser new window NO OTHER CHOICE)
  // CodeMirror.keyMap.krx["Ctrl-O"] = undefined;
  CodeMirror.keyMap.krx["Ctrl-P"] = doNothing;
  // CodeMirror.keyMap.krx["Ctrl-Q"] = undefined;
  CodeMirror.keyMap.krx["Ctrl-R"] = "redo"; // (browser reload page)
  CodeMirror.keyMap.krx["Ctrl-S"] = "save";
  // CodeMirror.keyMap.krx["Ctrl-T"] = undefined; // (browser new tab)
  // CodeMirror.keyMap.krx["Ctrl-U"] = "undo";
  // CodeMirror.keyMap.krx["Ctrl-V"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-W"] = undefined; // (browser close window NO OTHER CHOICE)
  // CodeMirror.keyMap.krx["Ctrl-X"] = "delCharAfter";
  // CodeMirror.keyMap.krx["Ctrl-Y"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Z"] = undefined;
  CodeMirror.keyMap.krx["Ctrl-Up"] = moveLineUp;
  CodeMirror.keyMap.krx["Ctrl-Down"] = moveLineDown;
  // CodeMirror.keyMap.krx["Ctrl-Backspace"] = undefined; // (browser delWordBefore)

  CodeMirror.keyMap.krx["Shift-Tab"] = "insertSoftTab"; // TODO ?
  CodeMirror.keyMap.krx["Shift-F3"] = "findPrev";

  // CodeMirror.keyMap.krx["Shift-Alt-A"] = "goLineEnd";
  // CodeMirror.keyMap.krx["Shift-Alt-B"] = undefined;
  CodeMirror.keyMap.krx["Shift-Alt-C"] = function (cm) {
    operateUntilWordAfter(cm, capitalize);
  };
  CodeMirror.keyMap.krx["Shift-Alt-D"] = "deleteLine";
  // CodeMirror.keyMap.krx["Shift-Alt-E"] = "transposeChars";
  CodeMirror.keyMap.krx["Shift-Alt-F"] = doNothing; // (firefox [File] shortcut)
  CodeMirror.keyMap.krx["Shift-Alt-G"] = doNothing;
  // CodeMirror.keyMap.krx["Shift-Alt-H"] = "goCharLeft";
  CodeMirror.keyMap.krx["Shift-Alt-I"] = "goLineStartSmart";
  // CodeMirror.keyMap.krx["Shift-Alt-J"] = "goLineDown";
  // CodeMirror.keyMap.krx["Shift-Alt-K"] = "goLineUp";
  // CodeMirror.keyMap.krx["Shift-Alt-L"] = "goCharRight";
  // CodeMirror.keyMap.krx["Shift-Alt-M"] = undefined;
  CodeMirror.keyMap.krx["Shift-Alt-N"] = "findPrev";
  CodeMirror.keyMap.krx["Shift-Alt-O"] = function (cm) {
    cm.execCommand("goLineStart");
    cm.replaceSelection("\n");
    cm.execCommand("goCharLeft");
  };
  // CodeMirror.keyMap.krx["Shift-Alt-P"] = undefined;
  // CodeMirror.keyMap.krx["Shift-Alt-Q"] = undefined;
  CodeMirror.keyMap.krx["Shift-Alt-R"] = "replaceAll";
  CodeMirror.keyMap.krx["Shift-Alt-S"] = "delCharAfter";
  CodeMirror.keyMap.krx["Shift-Alt-T"] = doNothing; // TODO transposeWords (firefox [Tools] shortcut)
  CodeMirror.keyMap.krx["Shift-Alt-U"] = "redo";
  CodeMirror.keyMap.krx["Shift-Alt-V"] = "krxConvertSelectionToSquareSelection"; // (firefox [View] shortcut)
  // CodeMirror.keyMap.krx["Shift-Alt-W"] = undefined;
  CodeMirror.keyMap.krx["Shift-Alt-X"] = "delCharBefore";
  // CodeMirror.keyMap.krx["Shift-Alt-Y"] = undefined;
  // CodeMirror.keyMap.krx["Shift-Alt-Z"] = undefined;
  CodeMirror.keyMap.krx["Shift-Alt-3"] = doNothing; // TODO searchThisWordPrevious
  CodeMirror.keyMap.krx["Shift-Alt-4"] = "goLineEnd";
  CodeMirror.keyMap.krx["Shift-Alt-8"] = doNothing; // TODO searchThisWordNext
  CodeMirror.keyMap.krx["Shift-Alt-,"] = "goDocStart";
  CodeMirror.keyMap.krx["Shift-Alt-."] = "goDocEnd";
  CodeMirror.keyMap.krx["Shift-Alt-<"] = "goDocStart"; // TODO doesn't work
  CodeMirror.keyMap.krx["Shift-Alt->"] = "goDocEnd"; // TODO doesn't work
  CodeMirror.keyMap.krx["Shift-Alt-["] = "indentLess";
  CodeMirror.keyMap.krx["Shift-Alt-]"] = "indentMore";
  CodeMirror.keyMap.krx["Shift-Alt--"] = "krxAutocompleteWordReverse";
  CodeMirror.keyMap.krx["Shift-Alt-Space"] = "krxAutocompleteWordReverse";
  CodeMirror.keyMap.krx["Shift-Alt-Backspace"] = "delWordAfter";

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
  keyIdentifier "left" 37 
  keyIdentifier "right" 39
  */
  
  var OBJECT_MENU = "<span>Name:</span><input type=\"text\" />" +
    "<span class='custom-menu-typewriter'>CTRL+ALT+</span>" +
    "<button class='custom-menu-button'><b>S</b>ave</button>" +
    "<button class='custom-menu-button'><b>C</b>lose</button>" +
    "<button class='custom-menu-button'><b>D</b>elete</button>";
  
  var OBJECT_LIST_MENU = "<span>Search:</span><input type=\"text\" />";
  
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
    console.log("navigation callback called");
    if (my_event.ctrlKey && my_event.altKey) {
      switch(my_event.keyCode) {
        case 88:
          console.log("CLOSE");
          my_callback();
        break;
        case 37:
          if (setNavigationMenu("left") === undefined) {
            console.log("CLOSE");
            my_callback();
          }
          break;
        case 39:
          if (setNavigationMenu("right") === undefined) {
            console.log("CLOSE");
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
    console.log("enterCallback");
    console.log(my_selected_value);
    console.log(my_event);
  }
  
  // http://codemirror.net/doc/manual.html#addon_dialog
  function navigateRight(cm) {
    console.log("CALLED NAVIGATE RIGHT");
    
    var menu = setNavigationMenu("right");
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
          "onInput": function (e, val, close) {
            console.log("INPUT");
            console.log(e);
            console.log(val);
          }
        }
      );
    }
  }
  CodeMirror.commands.krxNavigateRight = navigateRight;

  function navigateLeft(cm) {
    console.log("CALLED NAVIGATE LEFT");

    var menu = setNavigationMenu("left");
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
          console.log("INPUT");
          console.log(e);
          console.log(val);
        }
      });
    }
  }
  
  CodeMirror.commands.krxNavigateLeft = navigateLeft;
  
  // CodeMirror.keyMap.krx["Ctrl-Alt-A"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-B"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-C"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-D"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-E"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-F"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-G"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-H"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-I"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-J"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-K"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-L"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-M"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-N"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-O"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-P"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-Q"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-R"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-S"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-T"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-U"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-V"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-W"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-X"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-Y"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt-Z"] = undefined;
  // CodeMirror.keyMap.krx["Ctrl-Alt--"] = undefined;
  CodeMirror.keyMap.krx["Ctrl-Alt-Right"] = "krxNavigateRight";
  CodeMirror.keyMap.krx["Ctrl-Alt-Left"] = "krxNavigateLeft";
  // CodeMirror.keyMap.krx["Ctrl-Alt-Return"] = undefined;

}(this));
