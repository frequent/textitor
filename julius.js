/*jslint nomen: true, indent: 2, maxerr: 3 */
/*global window, navigator, RSVP */
(function(window, navigator, RSVP, undefined) {

  var AUDIO_CONTEXT = window.AudioContext || window.webkitAudioContext;
  var MEDIA_DEVICES = navigator.mediaDevices;

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
  
  function postBuffer() {
    var julius_instance = this;
    return function (my_event) {
      var buffer = my_event.inputBuffer.getChannelData(0),
        out,
        i;

      if (julius_instance.audio._transfer) {
        out = my_event.outputBuffer.getChannelData(0);
        for (i = 0; i < 4096; i += 1) {
          out[i] = buffer[i];
        }
      }

      // transfer audio to recognizer
      return RSVP.Queue()
        .push(function () {
          return julius_instance.sendMessage(buffer);
        });
    };
  }

  function initializeAudio(my_audio) {
    my_audio.context = new AUDIO_CONTEXT();
    my_audio.processor = my_audio.context.createScriptProcessor(4096, 1, 1);
  }

  function handleCallback(my_event) {
    var julius_instance = this;
    switch (my_event.data.type) {
      case 'begin':
        julius_instance.audio.processor.onaudioprocess = postBuffer.call(julius_instance);
        break;
      case 'recog':
        if (my_event.data.firstpass) {
          typeof julius_instance.onfirstpass === 'function' &&
            julius_instance.onfirstpass(my_event.data.sentence, my_event.data.score);
        } else {
          typeof julius_instance.onrecognition === 'function' &&
            julius_instance.onrecognition(my_event.data.sentence);
        }
        break;
      case 'log':
        typeof julius_instance.onlog === 'function' &&
          julius_instance.onlog(my_event.data.sentence);
        break;
      case 'error':
        julius_instance.terminate(my_event.data.error);
        break;
      default:
        console.info('Unexpected data received from julius:');
        console.info(my_event.data);
        break;
    }
  }

  function bootstrap(my_option_dict) {
    var julius_instance = this;

    return new RSVP.Queue()
      .push(function () {
        return navigator.mediaDevices.getUserMedia({audio: true});
      })
      .push(function (my_stream) {
        var audio = julius_instance.audio,
          recognizer = julius_instance.recognizer;

        // set source to input stream and connect
        audio.source = audio.context.createMediaStreamSource(my_stream);
        audio.source.connect(audio.processor);

        // connect with destination
        audio.processor.connect(audio.context.destination);

        // and go
        return julius_instance.sendMessage({"type": 'begin', "options": my_option_dict});
      })
      .push(null, function (my_error) {
        julius_instance.terminate(my_error);
        throw my_error;
      });
  }

  function Julius(my_option_dict) {
    var julius_instance = this,
      option_dict = my_option_dict || {};

    if (!AUDIO_CONTEXT) {
      throw new TypeError("Browser does not support AudioContext");
    }
    if (!MEDIA_DEVICES) {
      throw new TypeError("Browser does not support navigator.MediaDevices");
    }

    julius_instance.sendMessage = function (my_message) {
      return new RSVP.Promise(function (resolve, reject, notify) {
        julius_instance.recognizer.onmessage = function (my_event) {
          if (my_event.data.error) {
              reject(handelCallback.call(julius_instance, my_event));
            } else {
              resolve(handleCallback.call(julius_instance, my_event));
            }
          };

        return julius_instance.recognizer.postMessage(my_message);
      });
    };
         

    // The context's nodemap: source => processor => destination
    // context => Browser AudioContext
    // source => AudioSourceNode from captured microphone input
    // processor => ScriptProcessorNode for julius
    julius_instance.audio = {
      context: null,
      source: null,
      processor: null,
      _transfer: my_option_dict.transfer
    };

    // Do not pollute the object
    delete option_dict.transfer;
    
    // Recognition is offloaded to a separate thread to avoid slowing UI
    julius_instance.recognizer = new Worker(option_dict.pathToWorker || 'worker.js');

    initializeAudio(julius_instance.audio);
    bootstrap.call(julius_instance, option_dict);
  }
  
  Julius.prototype.onfirstpass = function(sentence) {};
  Julius.prototype.onrecognition = function(sentence, score) {};
  Julius.prototype.onlog = function(my_object) {
    console.log(my_object);
  };
  Julius.prototype.onfail = function(my_error) {
    console.log(my_error);
  };

  Julius.prototype.terminate = function(my_termination_reason) {
    var julius_instance = this;

    julius_instance.audio.processor.onaudioprocess = null;
    julius_instance.recognizer.terminate();
    if (typeof julius_instance.onfail === 'function') {
      julius_instance.onfail(my_termination_reason);
    }
  };

  window.Julius = Julius;

}(window, window.navigator, RSVP));
