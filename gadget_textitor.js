/*jslint nomen: true, indent: 2, maxerr: 3 */
/*global window, rJS */
(function (window, rJS) {
  "use strict";
  
  function initializeStorage(my_gadget) {
    console.log("initializing storage");

    return new RSVP.Queue()
      .push(function () {
        return my_gadget.jio_create({
          "type": "serviceworker",
          "cache": "textitor"
        });
      })
      
      // try
      .push(function (my_storage) {
        return my_gadget.forwardStorageRequest("jio_put", "textitor");
      })
      .push(function (my_id) {
        return my_gadget.forwardStorageRequest("jio_putAttachment", [
          my_id,
          "http://foo.css", 
          new Blob(["span%2C%20div%20%7Bborder%3A%201px%20solid%20red%20!important%3B%7D"], {
            type: "text/css",
          })
        ]);
      })
      .push(function () {
        console.log("allset");
      }, function (e) {
        console.log(e);
        throw e;
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
        })
        .push(undefined, function (e) {
          console.log(e);
          throw e;
        });
    })

    .declareMethod('render', function (my_option_dict) {
      var gadget = this,
        return_gadget;
      console.log("RENDER");
      
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
          return initializeStorage(gadget);
        })
        .push(function () {
          return return_gadget;
        });
    })

    .declareMethod("forwardStorageRequest", function (my_method, my_param_list) {
      var gadget = this;
      return new RSVP.Queue()
        .push(function () {
          return gadget.getDeclaredGadget("serviceworker");
        })
        .push(function (my_service_worker_gadget) {
          return my_service_worker_gadget.routeStorageRequest(my_method, my_param_list);
        });
    })
    //////////////////////////////////////////////
    // published methods
    //////////////////////////////////////////////
    
    // jIO bridge
    .allowPublicAcquisition("jio_create", function (param_list) {
      return this.forwardStorageRequest("createJIO", param_list);
    })
    .allowPublicAcquisition("jio_allDocs", function (param_list) {
      return this.forwardStorageRequest("allDocs", param_list);
    })
    .allowPublicAcquisition("jio_remove", function (param_list) {
      return this.forwardStorageRequest("remove", param_list);
    })
    .allowPublicAcquisition("jio_post", function (param_list) {
      return this.forwardStorageRequest("post", param_list);
    })
    .allowPublicAcquisition("jio_put", function (param_list) {
      return this.forwardStorageRequest("put", param_list);
    })
    .allowPublicAcquisition("jio_get", function (param_list) {
      return this.forwardStorageRequest("get", param_list);
    })
    .allowPublicAcquisition("jio_allAttachments", function (param_list) {
      return this.forwardStorageRequest("allAttachments", param_list);
    })
    .allowPublicAcquisition("jio_getAttachment", function (param_list) {
      return this.forwardStorageRequest("getAttachment", param_list);
    })
    .allowPublicAcquisition("jio_putAttachment", function (param_list) {
      return this.forwardStorageRequest("putAttachment", param_list);
    })
    .allowPublicAcquisition("jio_removeAttachment", function (param_list) {
      return this.forwardStorageRequest("removeAttachment", param_list);
    })
    .allowPublicAcquisition("jio_repair", function (param_list) {
      return this.forwardStorageRequest("repair", param_list);
    })
    
    //////////////////////////////////////////////
    // acquired methods
    //////////////////////////////////////////////
    .declareAcquiredMethod("jio_create", function (param_list) {
      return this.forwardStorageRequest("createJIO", param_list);
    })
    
}(window, rJS));
