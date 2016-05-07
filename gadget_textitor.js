/*jslint nomen: true, indent: 2, maxerr: 3 */
/*global window, rJS */
(function (window, rJS) {
  "use strict";

  function initializeStorage(my_gadget, my_name) {
    var config;
    
    if (my_name === "serviceworker") {
      config = {"type": "serviceworker", "cache": "textitor"};
    } else {
      config = {"type": "memory"};
    }
          
    // calling without method acquisition, so call direct method
    return new RSVP.Queue()
      .push(function () {
        return my_gadget.setActiveStorage([my_name]);
      })
      .push(function () {
        my_gadget.routeStorageRequest("createJIO", config);
      })
      .push(function () {
        return my_gadget.routeStorageRequest("put", "textitor");
      })
      .push(function (my_id) {
        return my_gadget.routeStorageRequest("putAttachment", [
          my_id,
          "http://foo.css",
          new Blob(["span%2C%20div%20%7Bborder%3A%201px%20solid%20red%20!important%3B%7D"], {
            type: "text/css"
          })
        ]);
      });

  }

  rJS(window)

    .ready(function (my_gadget) {
      my_gadget.property_dict = {};

      return new RSVP.Queue()
        .push(function () {
          return my_gadget.getElement();
        })
        .push(function (my_element) {
          my_gadget.property_dict.element = my_element;
          my_gadget.property_dict.storage_dict = {};
          my_gadget.property_dict.storage_dict.active = null;
        })
        .push(function () {
          return RSVP.all([
            my_gadget.getDeclaredGadget("jio_gadget"),
            my_gadget.getDeclaredGadget("jio_gadget")
          ]);
        })
        .push(function (my_declared_gadget_list) {
          return RSVP.all([
            my_declared_gadget_list[0].render({"label":"storage-serviceworker"}),
            my_declared_gadget_list[1].render({"label":"storage-memory"})
          ]);
        })
        .push(function (my_rendered_list) {
          my_gadget.property_dict.storage_dict.serviceworker = my_rendered_list[0];
          my_gadget.property_dict.storage_dict.memory = my_rendered_list[1];
        });
    })

    .declareMethod('render', function (my_option_dict) {
      var gadget = this,
        return_gadget;

      return new RSVP.Queue()
        .push(function () {
          return RSVP.all([
            gadget.getDeclaredGadget("codemirror"),
            gadget.getDeclaredGadget("serviceworker"),
          ]);
        })
        .push(function (my_declared_gadget_list) {
          return RSVP.all([
            my_declared_gadget_list[0].render(my_option_dict || {}),
            my_declared_gadget_list[1].render(my_option_dict || {})
          ]);
        })
        .push(function (my_rendered_gadget_list) {
          return_gadget = my_rendered_gadget_list[0];
          return RSVP.all([
            initializeStorage(gadget, "memory"),
            initializeStorage(gadget, "serviceworker")
          ]);
        })
        .push(function () {
          return return_gadget;
        });
    })
    
    .declareMethod('setActiveStorage', function (my_type) {
      var gadget = this;
      gadget.property_dict.storage_dict.active = my_type[0];
      console.log("set to:")
      console.log(gadget.property_dict.storage_dict);
      return gadget;
    })
    
    .declareMethod('routeStorageRequest', function (my_method, my_param_list) {
      var gadget = this,
        dict = gadget.property_dict,
        active_storage_label = dict.storage_dict.active || "serviceworker",
        storage = dict.storage_dict[active_storage_label];
      
      console.log(active_storage_label)
      console.log(storage.state_parameter_dict.label)
      
      return storage[my_method].apply(storage, [].concat(my_param_list));
    })

    // jIO bridge
    .allowPublicAcquisition("setActiveStorage", function (param_list) {
      return this.setActiveStorage(param_list);
    })
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
    });

}(window, rJS));
