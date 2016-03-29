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

    .declareMethod('routeStorageRequest', function (my_method, my_param_list) {
      var gadget = this;
      console.log("inside routeStorageRequest in serviceworker");
      console.log(my_method);
      console.log(my_param_list);
      return new RSVP.Queue()
        .push(function () {
          return gadget.getDeclaredGadget("jio_gadget");
        })
        .push(function (my_jio_gadget) {
          return my_jio_gadget.render();
        })
        .push(function (my_rendered_jio_gadget) {
          console.log(my_rendered_jio_gadget);
          console.log("and");
          console.log(my_rendered_jio_gadget.createJIO);
          return my_rendered_jio_gadget[my_method].apply(jio_gadget, my_param_list);
        })
        .push(undefined, function (error) {
          throw error;
        });
    })
    
    .declareAcquiredMethod('jio_create', 'jio_create')
    .declareAcquiredMethod('jio_allDocs', 'jio_allDocs')
    .declareAcquiredMethod('jio_remove', 'jio_remove')
    .declareAcquiredMethod('jio_post', 'jio_post')
    .declareAcquiredMethod('jio_put', 'jio_put')
    .declareAcquiredMethod('jio_get', 'jio_get')
    .declareAcquiredMethod('jio_allAttachments', 'jio_allAttachments')
    .declareAcquiredMethod('jio_removeAttachment', 'jio_removeAttachments')
    .declareAcquiredMethod('jio_putAttachment', 'jio_putAttachment')
    .declareAcquiredMethod('jio_getAttachment', 'jio_getAttachment')
    .declareAcquiredMethod('jio_repair', 'jio_repair')

}(window, rJS));
