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
      console.log("RENDER")
      return this;
    })

    .declareMethod('routeStorageRequest', function () {
      console.log("ROUTE REQUEST")
      var gadget = this;
      console.log(gadget)
      return new RSVP.Queue()
        .push(function () {
          return gadget.getDeclaredGadget("jio_gadget");
        })
        .push(function (my_jio_gadget) {
          return my_jio_gadget[arguments[0]].apply(jio_gadget, arguments[1]);
        })
        .push(undefined, function (error) {
          throw error;
        });
    });
    

}(window, rJS));
