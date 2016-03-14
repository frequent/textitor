/**
 * JIO Service Worker Storage Backend.
 */

// can we?
// self.importScripts('rsvp.js');

// https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers

var URL_LIST = {};
var CACHE_VERSION = 1;
var CURRENT_CACHES = {
  'jio': 'message-cache-version-' + CACHE_VERSION
};

// happens in the background while an existing version remains in control
// XXX define cache? access? 
self.addEventListener('install', function (event) {
  console.log(event)
});

// make changes that would have broken old page, such as deleting old caches
self.addEventListener('activate', function (event) {
  console.log(event)
  // delete unlisted cache in CURRENT_CACHES, handle multiple versioned caches
  var expectedCacheNames = Object.keys(CURRENT_CACHES).map(function(key) {
    return CURRENT_CACHES[key];
  });

  event.waitUntil(caches.keys()
    .then(function(cache_name_list) {
      return Promise.all(
        cache_name_list.map(function(cache_name) {
          if (expectedCacheNames.indexOf(cache_name) == -1) {
            return caches.delete(cache_name);
          }
        })
      );
    })
  );
});

// catches network request, allows to serve form cache or fetch from network
self.addEventListener('fetch', function (event) {
  console.log(event)
  var url = event.request.url;
  if (event.request.method === "GET") {
    
    // register uncached resources
    if (URL_LIST[url] === undefined) {
      URL_LIST[url] = {
        cached: false,
        request_number: 0,
        url: url,
      };
    }

    URL_LIST[url].request_number = URL_LIST[url].request_number + 1;

    event.respondWith(
      caches.open(CURRENT_CACHES['jio'])
        .then(function(cache) {
          return cache.match(event.request)
            .then(function(response) {
            
              // response CACHEd, return
              if (response) {
                URL_LIST[event.request.url].cached = true;
                return response;
              
              // no entry for event.request, fetch from network
              } else {
                
                // clone() call, because might be used to cache.put() later
                // fetch() and cache.put() consume request, so need a copy
                // (see https://fetch.spec.whatwg.org/#dom-request-clone)
                return fetch(event.request.clone()).then(function(response) {
                  // console.log('Response for %s: %O', event.request.url, response.url);
                  // Return the original response object, which will be used to 
                  // fulfill the resource request.
                  
                  // add resource to cache
                  //cache.put(event.request, response.clone());
                  return response;
                });
              }
            })
            .catch(function(error) {
              // This catch() will handle exceptions that arise from the match()
              // or fetch() operations. Note that a HTTP error response (e.g.
              // 404) will NOT trigger an exception. It will return a normal 
              // response object that has the appropriate error code set.
              console.error('Error in fetch handler:', error);
              throw error;
            });
      })
    );
  } else {
    event.respondWith(fetch(event.request));
  }
});

// custom message communication
self.addEventListener('message', function(event) {
  var request;
    console.log(event)
  // xxx ?
  if (URL_LIST === undefined) {
    URL_LIST = {};
  }

  // xxx why hardcode?
  caches.open(CURRENT_CACHES['cribjs'])
    .then(function(cache) {
      
      switch (event.data.command) {
      
        // returns a list of the URLs corresponding to the Request objects
        // that serve as keys for the current cache.
        case 'keys':
          cache.keys().then(function(requests) {
            var urls = requests.map(function(request) {
              return request.url;
            });

            // event.ports[0] corresponds to the MessagePort that was 
            // transferred as part of the controlled page's call to 
            // controller.postMessage(). Therefore, event.ports[0].postMessage() 
            // will trigger the onmessage handler from the controlled page.
            // It's up to you how to structure the messages that you send back; 
            // this is just one example.
            event.ports[0].postMessage({
              error: null,
              urls: urls.sort()
            });
          });
        break;
      
        // ?
        case 'allDocs':
          cache.keys().then(function(requests) {
            var urls = requests.map(function(request) {
              return request.url;
            }), i, i_len, url;
          
            for (i = 0, i_len = urls.length; i < i_len; i += 1) {
              url = urls[i];
              if (URL_LIST[url] === undefined) {
                URL_LIST[url] = {
                  cached: true,
                  request_number: 0,
                  url: url,
                };
              }            
            }
            event.ports[0].postMessage({
              error: null,
              urls: URL_LIST
            });
          });
        break;

        // Add a new request/response pair to the cache.
        case 'add':
          
          // If event.data.url isn't a valid URL, new Request() will throw a 
          // TypeError which will be handled by the outer .catch().
          // Hardcode {mode: 'no-cors} since the default for new Requests 
          // constructed from strings is to require CORS, and we don't have any 
          // way of knowing whether an arbitrary URL that a user entered 
          // supports CORS.
          request = new Request(event.data.url, {mode: 'no-cors'}),
          response = new Response(event.data.information);
          if (URL_LIST[request.url] === undefined) {
            URL_LIST[request.url] = {
              cached: true,
              request_number: 0,
              url: request.url,
              };
          }
          cache.put(request, response).then(function() {
            event.ports[0].postMessage({
              error: null
            });
          });
        break;

        // removes a request/response pair from the cache (assuming it exists).
        case 'delete':
          request = new Request(event.data.url, {mode: 'no-cors'});
          cache.delete(request).then(function(success) {
            event.ports[0].postMessage({
              error: success ? null : 'Item was not found in the cache.'
            });
          });
          if (URL_LIST[request.url] !== undefined) {
            URL_LIST[request.url].cached = false;
          }
        break;
  
        default:
          // This will be handled by the outer .catch().
          throw 'Unknown command: ' + event.data.command;
      }
    })
    .catch(function(error) {
      
      // If the promise rejects handle it by returning a standardized error
      // message to the controlled page.
      console.error('Message handling failed:', error);
  
      event.ports[0].postMessage({
        error: error.toString()
      });
    });
});

/* 


  FileSystemBridgeStorage.prototype.buildQuery = function () {
    var result_dict = {},
      context = this;
    return new RSVP.Queue()

      // First, get list of explicit documents

      .push(function () {
        return context._sub_storage.allAttachments(DOCUMENT_KEY);
      })
      .push(function (result) {
        var key;
        for (key in result) {
          if (result.hasOwnProperty(key)) {
            if (endsWith(key, DOCUMENT_EXTENSION)) {
              result_dict[key.substring(
                0,
                key.length - DOCUMENT_EXTENSION.length
              )] = null;
            }
          }
        }
      }, function (error) {
        if ((error instanceof jIO.util.jIOError) &&
            (error.status_code === 404)) {
          return;
        }
        throw error;
      })

      // Second, get list of enclosure

      .push(function () {
        return context._sub_storage.allAttachments(ROOT);
      })
      .push(function (result) {
        var key;
        for (key in result) {
          if (result.hasOwnProperty(key)) {
            result_dict[key] = null;
          }
        }
      })

      // Finally, build the result

      .push(function () {
        var result = [],
          key;
        for (key in result_dict) {
          if (result_dict.hasOwnProperty(key)) {
            result.push({
              id: key,
              value: {}
            });
          }
        }
        return result;
      });

  };
  */
