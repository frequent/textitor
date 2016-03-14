/**
 * JIO Service Worker Storage Type = "serviceworker".
 * Servieworker "filesystem" storage.
 */
/*global Blob, jIO, RSVP*/
/*jslint nomen: true*/

(function (jIO, RSVP, Blob) {
  "use strict";

  var URL_PATTERN = /(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/;
  var DOCUMENT_EXTENSION = "enclosure";

  function restrictDocumentId(url) {
    if (URL_PATTERN.test(url) === false) {
      throw new jIO.util.jIOError("url " + url + " is not an url. ",
                                  400);
    }
    return url;
  }

  function restrictAttachmentId(url) {
    if (url.indexOf("/") !== -1) {
      throw new jIO.util.jIOError("attachment " + url + " is forbidden",
                                  400);
    }
  }

  function validateConnection(cache_id) {
    if ('serviceWorker' in navigator) {
      if (navigator.serviceWorker.controller === undefined) {
        return new RSVP.Promise(function(resolve, reject) {
          navigator.serviceWorker.register(
            'serviceworker.js', {
              scope: './', 
              cache: cache_id // XXX not sure this works
            }
          )
          .then(function () {
            if (navigator.serviceWorker.controller) {
              resolve();
            } else {
              reject(new Error("Please refresh to initialize serviceworker"));
            }
          }).catch(function (err) {
            reject(err);
          });
        });
      }
    } else {
      throw new jIO.util.jIOError("Serviceworker not available in browser",
                                  503);
    }
  }

  // This wraps the message posting/response in a promise, which will resolve if
  // the response doesn't contain an error, and reject with the error if it does.
  // Alternatively, onmessage handle and controller.postMessage() could be used
  function sendMessage(message) {
    return new RSVP.Promise(function (resolve, reject, notify) {
      var messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = function (event) {
        if (event.data.error) {
          reject(event.data.error);
        } else {
          resolve(event.data);
        }
      };

      // This sends the message data as well as transferring
      // messageChannel.port2 to the service worker. The service worker can then
      // use the transferred port to reply via postMessage(), which will in turn
      // trigger the onmessage handler on messageChannel.port1.
      // See https://html.spec.whatwg.org/multipage/workers.html
      return navigator.serviceWorker.controller
        .postMessage(message, [messageChannel.port2]);
    });
  }

  /**
   * The JIO Serviceworker Storage extension
   *
   * @class ServiceWorkerStorage
   * @constructor
   */
  function ServiceWorkerStorage (spec) {
    if (typeof spec.cache !== 'string' || !spec.cache) {
      throw new TypeError("Cache' must be a string " +
                          "which contains more than one character.");
    }
    this._cache = spec.cache;
  }

  ServiceWorkerStorage.prototype.post = function () {
    throw new jIO.util.jIOError("Storage requires 'put' with resource url as id",
                                400);
  };

  ServiceWorkerStorage.prototype.put = function (url, param) {
    var context = this;
    url = restrictDocumentId(url);
    return new RSVP.Queue()
      .push(function () {
        return validateConnection(context._cache);
      })
      .push(function () {
        return sendMessage({
          command: 'putAttachment',
          id: url,
          name: "enclosure",
          content: new Blob([param.content], {
            type: param.type,
          })
        });
      })
      .push(undefined, function (error) {
        if ((error instanceof jIO.util.jIOError) &&
          (error.status_code === 404)) {
          return new RSVP.Queue()
            .push(function () {
              return sendMessage({
                command: 'put',
                id: url
              });
            })
            .push(function () {
              return sendMessage({
                command: 'putAttachment',
                id: url,
                name: url + DOCUMENT_EXTENSION,
                content: new Blob([param.content], {
                  type: param.type,
                })
              });
            });
        }
        throw error;
      })
      .push(function () {
        return url;
      });
  };

  ServiceWorkerStorage.prototype.get = function (url) {
    var context = this;

    // NOTE: alternatively get could also be run "official" way via
    // an ajax request, which the serviceworker would catch via fetch listener!
    // for a filesystem equivalent however, we don't assume fetching resources
    // from the network, so all methods will go through sendMessage

    return new RSVP.Queue()
      .push(function () {
        return validateConnection(context._cache);
      })
      .push(function () {
        return sendMessage({
          command: 'getAttachment',
          id: url,
          name: url + DOCUMENT_EXTENSION
        });
      })
      .push(undefined, function (error) {
        if ((error instanceof jIO.util.jIOError) &&
            (error.status_code === 404)) {
          throw new jIO.util.jIOError("Cannot find document " + url, 404);
        }
        throw error;
      });
  };

  ServiceWorkerStorage.prototype.remove = function (url) {
    var context = this,
      got_error = false;

    // First, try to remove enclosure, then the document
    return new RSVP.Queue()
      .push(function () {
        return validateConnection(context._cache);
      })
      .push(function () {
        return sendMessage({
          command: 'removeAttachment',
          id: url,
          name: url + DOCUMENT_EXTENSION
        });
      })
      .push(undefined, function (error) {
        if ((error instanceof jIO.util.jIOError) &&
            (error.status_code === 404)) {
          got_error = true;
          return;
        }
        throw error;
      })
      .push(function () {
        return sendMessage({
          command: 'remove',
          id: url
        });
      })
      .push(undefined, function (error) {
        if ((!got_error) && (error instanceof jIO.util.jIOError) &&
            (error.status_code === 404)) {
          return url;
        }
        throw error;
      });
  };

  ServiceWorkerStorage.prototype.getAttachment = function (url, name) {
    throw new jIO.util.jIOError("Only support 'enclosure' attachment",
                                400);
  };

  ServiceWorkerStorage.prototype.putAttachment = function (url, name) {
    throw new jIO.util.jIOError("Only support 'enclosure' attachment",
                                400);
  };
  ServiceWorkerStorage.prototype.removeAttachment = function (url, name) {
    throw new jIO.util.jIOError("Only support 'enclosure' attachment",
                                400);
  };
  ServiceWorkerStorage.prototype.allAttachments = function () {
    throw new jIO.util.jIOError("Only support 'enclosure' attachment",
                                400);
  };
  ServiceWorkerStorage.prototype.hasCapacity = function (name) {
    return ((name === "list") || (name === "include"));
  };

  ServiceWorkerStorage.prototype.allDocs = function (options) {
    var context = this;

    if (options === undefined) {
      options = {};
    }
    return new RSVP.Queue()
      .push(function () {
        return validateConnection(context._cache);
      })
      .push(function () {
        if (context.hasCapacity("list") &&
            ((options.include_docs === undefined) ||
             context.hasCapacity("include"))) {
          return context.buildQuery(options);
        }
      })
      .push(function (result) {
        return {
          data: {
            rows: result,
            total_rows: result.length
          }
        };
      });
  };

  ServiceWorkerStorage.prototype.buildQuery = function (options) {
    return new RSVP.Queue()
      .push(function () {
        return sendMessage({
          command: 'allDocs',
          options: options
        });
      });
  };

  jIO.addStorage('serviceworker', ServiceWorkerStorage);

}(jIO, RSVP, Blob));
