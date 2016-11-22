/*jslint nomen: true, indent: 2, maxerr: 3 */
/*global window, rJS */
(function (window, rJS, CodeMirror, annyang) {
  "use strict";

  rJS(window)

    .ready(function (my_gadget) {
      my_gadget.property_dict = {};
    })

    .declareMethod('render', function (my_option_dict) {
      var gadget = this;
      console.log(my_option_dict);
      console.log(annyang)
      return_gadget;
    });
    
}(window, rJS, CodeMirror, annyang));

