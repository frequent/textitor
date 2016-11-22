/*jslint nomen: true, indent: 2, maxerr: 3 */
/*global window, rJS */
(function (window, rJS, CodeMirror, annyang) {
  "use strict";

  //var utterance = new SpeechSynthesisUtterance('ok');
  //utterance.rate = 1.5;
  //window.speechSynthesis.speak(utterance);
  
  //https://github.com/alanjames1987/Cross-Browser-Voice-Recognition-with-PocketSphinx.js
  
  rJS(window)

    .ready(function (my_gadget) {
      my_gadget.property_dict = {};
    })

    .declareMethod('render', function (my_option_dict) {
      var gadget = this,
        commands = {},
        dictionary = my_option_dict.commands,
        command;
        
      for (command in dictionary) {
        if (dictionary.hasOwnProperty(command)) {
          commands[command] = CodeMirror.commands[dictionary[command]];
        }
      }

      annyang.addCommands(my_option_dict.commands);
      annyang.start();
      return gadget;
    });
    
}(window, rJS, CodeMirror, annyang));
