/*jslint nomen: true, indent: 2, maxerr: 3 */
/*global window, rJS, navigator */
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

      if ('serviceWorker' in navigator) {
        return new RSVP.Promise(function(resolve, reject) {
            navigator.serviceWorker.register('serviceworker.js', {scope: './'})
              .then(function () {
                if (navigator.serviceWorker.controller) {
                  resolve();
                } else {
                  reject(new Error("Please refresh to initialize serviceworker."));
                }
              }).catch(function (err) {
                reject(err);
              });
          });
      } else {
        throw new Error("Browser does not support serviceworker.");
      }
    });

}(window, rJS, navigator));
