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
      return new RSVP.Queue()
        .push(function () {
          return gadget.getDeclaredGadget("jio_gadget");
        })
        .push(function (my_jio_gadget) {
          console.log("routing");
          console.log(my_method)
          console.log(my_jio_gadget.createJio);
          return my_jio_gadget[my_method].apply(my_jio_gadget, my_param_list);
        })
        .push(undefined, function (error) {
          throw error;
        });
    })

    // jIO bridge
    .allowPublicAcquisition("jio_create", function (param_list) {
      return this.routeStorageRequest("createJIO", param_list);
    })
    .allowPublicAcquisition("jio_allDocs", function (param_list) {
      return this.routeStorageRequest("allDocs", param_list);
    })
    .allowPublicAcquisition("jio_remove", function (param_list) {
      return this.routeStorageRequest("remove", param_list);
    })
    .allowPublicAcquisition("jio_post", function (param_list) {
      return this.routeStorageRequest("post", param_list);
    })
    .allowPublicAcquisition("jio_put", function (param_list) {
      return this.routeStorageRequest("put", param_list);
    })
    .allowPublicAcquisition("jio_get", function (param_list) {
      return this.routeStorageRequest("get", param_list);
    })
    .allowPublicAcquisition("jio_allAttachments", function (param_list) {
      return this.routeStorageRequest("allAttachments", param_list);
    })
    .allowPublicAcquisition("jio_getAttachment", function (param_list) {
      return this.routeStorageRequest("getAttachment", param_list);
    })
    .allowPublicAcquisition("jio_putAttachment", function (param_list) {
      return this.routeStorageRequest("putAttachment", param_list);
    })
    .allowPublicAcquisition("jio_removeAttachment", function (param_list) {
      return this.routeStorageRequest("removeAttachment", param_list);
    })
    .allowPublicAcquisition("jio_repair", function (param_list) {
      return this.routeStorageRequest("repair", param_list);
    })
    
    

}(window, rJS));
