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
          return RSVP.all([
            gadget.getDeclaredGadget("codemirror"),
            gadget.getDeclaredGadget("serviceworker")
          ]);
        })
        .push(function (my_declared_gadget_list) {
          return RSVP.all([
            my_declared_gadget_list[0].render(my_option_dict || {}),
            my_declared_gadget_list[1].render(my_option_dict || {})
          ]);
        })
        .push(function (my_rendered_gadget_list) {
          return new RSVP.Queue()
            .push(function () {
              return jIO.createJIO({
                "type": "serviceworker",
                "cache": "textitor"
              });
            })
            .push(function (my_storage) {
              return RSVP.all([
                my_rendered_gadget_list[0],
                new RSVP.Queue()
                  .push(function () {
                    return my_storage.put("textitor");
                  })
                  .push(function (my_id) {
                    console.log(my_id);
                    return my_storage.putAttachment(
                      my_id, 
                      "http://foo.css", 
                      new Blob(["span%2C%20div%20%7Bborder%3A%201px%20solid%20red%20!important%3B%7D"], {
                        type: "text/css",
                      })
                    );
                  })
                ]);
              });
        });
    });
}(window, rJS));
