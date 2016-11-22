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
      var gadget = this;
      return new RSVP.Queue()
        .push(function () {
          return gadget.routeCodeMirrorCommand(my_command); 
        })
        .push(function (my_result) {
          console.log("done");
          console.log(my_result);
        })
        .push(null, function (my_error) {
          console.log(my_error);
          throw my_error;
        });
    })
    
    .declareMethod('render', function (my_option_dict) {
      var gadget = this,
        commands = {},
        dictionary = my_option_dict.commands,
        command;

      for (command in dictionary) {
        if (dictionary.hasOwnProperty(command)) {
          commands[command] = function () {
            return gadget.setCommand(dictionary[command]);
          }
        }
      }
      commands["test"] = function () {
        console.log("hello, test");
      }
      console.log(commands)
      annyang.addCommands(commands);
      annyang.start();
      return gadget;
    });
    
}(window, rJS, CodeMirror, annyang));

