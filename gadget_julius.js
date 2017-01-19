/*jslint nomen: true, indent: 2, maxerr: 3 */
/*global window, rJS, RSVP, Julius */
(function (window, rJS, RSVP, Julius) {
  "use strict";

  // Custom loopEventListener
  function juliusLoopEventListener(my_target, my_type, my_callback) {
    var handle_event_callback,
      callback_promise;

    function cancelResolver() {
      if ((callback_promise !== undefined) &&
        (typeof callback_promise.cancel === "function")) {
        callback_promise.cancel();
      }
    }
    function canceller() {
      cancelResolver();
    }
    function itsANonResolvableTrap(resolve, reject) {
      handle_event_callback = function (evt) {
        cancelResolver();
        callback_promise = new RSVP.Queue()
          .push(function () {
            return my_callback(evt);
          })
          .push(undefined, function (error) {
            if (!(error instanceof RSVP.CancellationError)) {
              canceller();
              reject(error);
            }
          });
      };
      // eg julius.onfirstpass = function () {...
      my_target["on" + my_type] = my_callback;
    }
    return new RSVP.Promise(itsANonResolvableTrap, canceller);
  }

  rJS(window)

    /////////////////////////////
    // ready
    /////////////////////////////
    .ready(function (my_gadget) {
      return new RSVP.Queue()
        .push(function () {
          return my_gadget.getElement();
        })
        .push(function (my_element) {
          my_gadget.property_dict = {"element": my_element};
        });
    })

    /////////////////////////////
    // acquired methods
    /////////////////////////////

    /////////////////////////////
    // declared methods
    /////////////////////////////
    .declareMethod('render', function (my_option_dict) {
      var gadget = this,
        props = gadget.property_dict;
      
      function updateDom(sentence) {
        props.element.textContent = sentence;
      }
      function statusMessage(sentence) {
        console.log(sentence);
      }

      props.julius = new Julius({
        path_to_worker: 'projec/julius_test/worker.js',
        dfa: 'project/julius_test/voxforge/sample.dfa',
        dict: 'project/julius_test/voxforge/sample.dict',
        log: true
      });
      
      // XXX overload prototype listeners: only keep first?
      return RSVP.all([
        juliusLoopEventListener(props.julius, 'recognition', updateDom),
        juliusLoopEventListener(props.julius, 'firstpass', statusMessage),
        juliusLoopEventListener(props.julius, 'log', statusMessage),
        juliusLoopEventListener(props.julius, 'fail', statusMessage)
      ]);

    });
    
}(window, rJS, RSVP, Julius));
