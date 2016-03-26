/*jslint nomen: true, indent: 2, maxerr: 3 */
/*global window, rJS */
(function (window, rJS) {
  "use strict";

  function callJioGadget(gadget, method, param_list) {
    var called = false;
    return new RSVP.Queue()
      .push(function () {
        return gadget.getDeclaredGadget("jio_gadget");
      })
      .push(function (jio_gadget) {
        return jio_gadget[method].apply(jio_gadget, param_list);
      })
      .push(undefined, function (error) {
        throw error;
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
          my_gadget.property_dict.jio_defer = RSVP.defer();
        
          console.log(my_gadget);
          console.log(my_gadget.property_dict.jio_defer);
          return my_gadget.property_dict.jio_defer.promise;
        })
        .push(function (my_resolved_defer_argument_list) {
          console.log("resolved");
          console.log(my_resolved_defer_argument_list);
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
          // need to pass this back
          return_gadget = my_rendered_gadget_list[0];
          console.log("A");
          return new RSVP.Queue()
            .push(function () {
              return gadget.property_dict.jio_defer.resolve();
            })
            .push(function () {
              return jIO.createJIO({
                "type": "serviceworker",
                "cache": "textitor"
              });
            })
            .push(function (my_storage) {
              return new RSVP.Queue()
                .push(function () {
                  return my_storage.put("textitor");
                })
                .push(function (my_id) {
                  return my_storage.putAttachment(
                    my_id, 
                    "http://foo.css", 
                    new Blob(["span%2C%20div%20%7Bborder%3A%201px%20solid%20red%20!important%3B%7D"], {
                      type: "text/css",
                    })
                  );
                })
                .push(function (my_response) {
                  return return_gadget;
                })
                .push(undefined, function (e) {
                  console.log(e);
                  throw e;
                });
            })
            .push(undefined, function (e) {
              console.log(e);
              throw e;
            });
        })
        .push(undefined, function (e) {
          console.log(e);
          throw e;
        });
    })
    
    // jIO bridge
    .allowPublicAcquisition("createJio", function (param_list) {
      return callJioGadget(this, "createJio", param_list);
    })
    .allowPublicAcquisition("jio_allDocs", function (param_list) {
      return callJioGadget(this, "allDocs", param_list);
    })
    .allowPublicAcquisition("jio_remove", function (param_list) {
      return callJioGadget(this, "remove", param_list);
    })
    .allowPublicAcquisition("jio_post", function (param_list) {
      return callJioGadget(this, "post", param_list);
    })
    .allowPublicAcquisition("jio_put", function (param_list) {
      return callJioGadget(this, "put", param_list);
    })
    .allowPublicAcquisition("jio_get", function (param_list) {
      return callJioGadget(this, "get", param_list);
    })
    .allowPublicAcquisition("jio_allAttachments", function (param_list) {
      return callJioGadget(this, "allAttachments", param_list);
    })
    .allowPublicAcquisition("jio_getAttachment", function (param_list) {
      return callJioGadget(this, "getAttachment", param_list);
    })
    .allowPublicAcquisition("jio_putAttachment", function (param_list) {
      return callJioGadget(this, "putAttachment", param_list);
    })
    .allowPublicAcquisition("jio_removeAttachment", function (param_list) {
      return callJioGadget(this, "removeAttachment", param_list);
    })
    .allowPublicAcquisition("jio_repair", function (param_list) {
      return callJioGadget(this, "repair", param_list);
    });
    
}(window, rJS));
