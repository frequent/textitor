/*jslint nomen: true, indent: 2, maxerr: 3 */
/*global window, rJS */
(function (window, rJS, CodeMirror) {
  "use strict";

  //var utterance = new SpeechSynthesisUtterance('ok');
  //utterance.rate = 1.5;
  //window.speechSynthesis.speak(utterance);
  

  
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
    
    
    /////////////////////////////
    // declared methods
    /////////////////////////////
    
    
    .declareMethod('render', function (my_option_dict) {
      var gadget = this
      return gadget;
    });
    
}(window, rJS, CodeMirror));

