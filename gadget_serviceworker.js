/*jslint nomen: true, indent: 2, maxerr: 3 */
/*global window, rJS */
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
        });
    })

    .declareMethod('render', function (my_option_dict) {
      return this;
    })
    
    .declareMethod('passRequest', function (my_method, my_param_list) {
      var gadget = this;
      console.log("passing to jio");
      return new RSVP.Queue()
        .push(function () {
          return gadget.getDeclaredGadget("jio_gadget");
        })
        .push(function (my_jio_gadget) {
          console.log(my_jio_gadget);
          console.log("calling with");
          console.log(my_method);
          console.log(my_param_list);
          return my_jio_gadget[my_method].apply(my_jio_gadget, my_param_list);
        })
        .push(undefined, function (error) {
          throw error;
        });
    });
    

}(window, rJS));
