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
      var gadget = this;
      console.log("inside serviceworker.js render")
      return new RSVP.Queue()
        .push(function () {
          return gadget.declareGadget("gadget_jio.html", {
            "scope": "jio_gadget_fallback"
          });
        })
        .push(function (my_declared_gadget) {
          return my_declared_gadget.render();
        })
        .push(function (my_rendered_gadget) {
          console.log(my_rendered_gadget);
          return gadget;
        })
    })

    .declareMethod('routeStorageRequest', function (my_method, my_param_list) {
      var gadget = this;
      console.log("inside routeStorageRequest in serviceworker");
      console.log(my_method);
      console.log(my_param_list);
      return new RSVP.Queue()
        .push(function () {
          return gadget.getDeclaredGadget("jio_gadget_fallback");
        })
        .push(function (my_rendered_jio_gadget) {
          console.log(my_rendered_jio_gadget);
          console.log("and");
          console.log(my_rendered_jio_gadget.prototype);
          return my_rendered_jio_gadget[my_method].apply(jio_gadget, my_param_list);
        })
        .push(undefined, function (error) {
          throw error;
        });
    });

}(window, rJS));
