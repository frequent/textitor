/*jslint nomen: true, indent: 2, maxerr: 3 */
/*global window, rJS */
(function (window, rJS, CodeMirror, annyang) {
  "use strict";

  //var utterance = new SpeechSynthesisUtterance('ok');
  //utterance.rate = 1.5;
  //window.speechSynthesis.speak(utterance);
  
  //https://github.com/alanjames1987/Cross-Browser-Voice-Recognition-with-PocketSphinx.js
  
  rJS(window)

    /////////////////////////////
    // ready
    /////////////////////////////
    .ready(function (my_gadget) {
      my_gadget.property_dict = {};
    })

    /////////////////////////////
    // acquired methods
    /////////////////////////////
    .declareAcquiredMethod('routeCodeMirrorCommand', 'routeCodeMirrorCommand')
    
    /////////////////////////////
    // declared methods
    /////////////////////////////
    .declareMethod('setCommand', function (my_command) {
      return this.routeCodeMirrorCommand(my_command);
    })
    
    .declareMethod('render', function (my_option_dict) {
      var gadget = this,
        commands = {},
        cmd;
      
      commands["left"] = function () {
        return gadget.setCommand("myEditor_navigateLeft");
      };
      commands["right"] = function () {
        return gadget.setCommand("myEditor_navigateRight");
      };
      commands["up"] = function () {
        return gadget.setCommand("myEditor_navigateDown");
      };
      commands["down"] = function () {
        return gadget.setCommand("myEditor_navigateUp");
      };
      commands["save"] = function () {
        return gadget.setCommand("myEditor_saveFromDialog");
      };
      commands["close"] = function () {
        return gadget.setCommand("myEditor_closeFile");
      };
      commands["open"] = function () {
        return gadget.setCommand("myEditor_openFromDialog");
      };
      commands["remove"] = function () {
        return gadget.setCommand("myEditor_deleteFile");
      };
      commands["search"] = function () {
        return gadget.setCommand("myEditor_searchFileMenu");
      };
      commands["bulk"] = function () {
        return gadget.setCommand("myEditor_bulkSaveFromDialog");
      };
      commands["sync"] = function () {
        return gadget.setCommand("myEditor_sync");
      };
      commands["pick"] = function () {
        return gadget.setCommand("myEditor_pickDialogOption");
      };
      commands["tab"] = function () {
        return gadget.setCommand("myEditor_traverseDialog");
      };
      commands["escape"] = function () {
        return gadget.setCommand("myEditor_closeDialog");
      };      
      
      
      /*
      gadget.property_dict.command_dict = my_option_dict.commands;

      for (cmd in gadget.property_dict.command_dict) {
        if (gadget.property_dict.command_dict.hasOwnProperty(cmd)) {
          commands[cmd] = function () {
            return gadget.setCommand(gadget.property_dict.command_dict[cmd]);
          };
        }
      }
      */
      annyang.addCommands(commands);
      annyang.start();
      return gadget;
    });
    
}(window, rJS, CodeMirror, annyang));
