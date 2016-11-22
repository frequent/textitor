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
      console.log("Call made with " + my_command)
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
        command_dict,
        cmd;
      
      gadget.property_dict.command_dict = command_dict = my_option_dict.commands;

      function wrap (my_parameter) {
        console.log("ok")
        console.log(my_parameter)
        return gadget.setCommand(my_parameter);
      }

      for (cmd in command_dict) {
        console.log(cmd)
        if (command_dict.hasOwnProperty(cmd)) {
          commands[cmd] = new RSVP.Queue()
            .push(function () {
              console.log(cmd)
              console.log(gadget.property_dict.command_dict[cmd])
              return wrap(gadget.property_dict.command_dict[cmd]);
            })
            .push(function(result) {
              console.log(result)
            });
        }
      }
      console.log("set")
      console.log(commands)
      commands["test"] = function () {
        console.log("hello, test");
      };
      
      annyang.addCommands(commands);
      annyang.start();
      return gadget;
    });
    
}(window, rJS, CodeMirror, annyang));
