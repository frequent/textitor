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
      return new RSVP.Queue()
        .push(function () {
          return gadget.declareGadget("gadget_couscous.html",
            {"scope":"textitor"}
          );
        })
        .push(function (my_declared_gadget) {
          return my_declared_gadget.render(my_option_dict || {});
        })
        .push(function (my_rendered_gadget) {
          gadget.property_dict.element.appendChild(my_rendered_gadget.property_dict.element);
        })
        .push(undefined, function (my_error) {
          console.log(my_error);
          document.body.textContent = my_error;
        });
    });

}(window, rJS));

