/**
 * JIO Service Worker Storage Backend.
 */

// https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
// http://www.html5rocks.com/en/tutorials/service-worker/introduction/

var DOCUMENT_EXTENSION = "enclosure";
var CURRENT_CACHE_VERSION = 1;
var CURRENT_CACHE_LIST = {};
var URL_LIST = {};

// custom message communication
self.addEventListener('message', function (event) {
  var result_list = [],
    cache_name = event.data.cache,
    option_dict = event.data.options || {},
    request,
    clearFromCache,
    getFromCache;

  clearFromCache = function (my_url) {         
    var request = new Request(my_url, {mode: 'no-cors'});
    cache.delete(request)
      .then(function(success) {
        event.ports[0].postMessage({
          error: success ? null : 'Item not found in cache.'
        });
      });
      if (URL_LIST[request.url] !== undefined) {
        URL_LIST[request.url].cached = false;
      }
  };
  
  getFromCache = function (my_url) {
    return cache.match(my_url)
      .then(function(my_response) {
        return my_response;
      });
  };

    
  if (CURRENT_CACHE_LIST[cache_name] === undefined) {
    CURRENT_CACHE_LIST[cache_name] = 'post-message-cache-v' + CACHE_VERSION;
  }
  event.respondWith(
    caches.open(CURRENT_CACHES[cache_name])
      .then(function(cache) {
        switch (event.data.command) {
        
          case 'put':
          case 'putAttachment':
            
          // retrieve from cache
          case 'get':
            getFromCache(event.data.id);
          break;
            
          // retrieve enclose from cache
          case 'getAttachment':
            getFromCache(event.data.name);
          break;
  
          // removes a request/response pair from the cache (assuming it exists)
          case 'remove':
            clearFromCache(event.data.id);
          break;
          
          // remove enclosure belonging to a document
          case 'removeAttachment':
            clearFromCache(event.data.name);
          break;
  
          case 'allDocs':
            
            // returns a list of the URLs corresponding to the Request objects
            // that serve as keys for the current cache. We assume all files
            // are kept in cache, so there will be no network requests.
  
            cache.keys().then(function (my_request_list) {
              var url_list = requests.map(function(my_request) {
                return my_request.url;
              }), 
              i, 
              i_len, 
              url;
              for (i = 0, i_len = url_list.length; i < i_len; i += 1) {
                url = url_list[i];
                if (URL_LIST[url] === undefined) {
                  URL_LIST[url] = {
                    cached: true,
                    request_number: 0,
                    url: url,
                  };
                }
                
                // only add if not an attachment (enclosure)
                if (url.indexOf(DOCUMENT_EXTENSION) === -1) {
                  result_list.push({
                    "id": url,
                    "value": {}
                  });
                }
              }
              if (option_dict.include_docs === undefined) {
                return result_list; 
              } else {
                return Promise.all(result_list.map(function (my_result) {
                  request = new Request(my_result.id + DOCUMENT_EXTENSION, {mode: 'no-cors'});
                  return cache.match(request)
                    .then(function(my_response) {
                      my_result.doc = my_response;
                      return my_result;
                    });
                }));
              }
            }).then(function (my_result_list) {
              
              // event.ports[0] corresponds to the MessagePort that was 
              // transferred as part of the controlled page's call to 
              // controller.postMessage(). Therefore, event.ports[0].postMessage() 
              // will trigger the onmessage handler from the controlled page.
              // It's up to you how to structure the messages that you send back; 
              // this is just one example.
              event.ports[0].postMessage({
                error: null,
                data: {
                  rows: result_list,
                  total_rows: result_list.length
                }
              });
            });
          break;
  
          // everything else we don't accept
          default:
            throw 'Unknown command: ' + event.data.command;
          
          
          
  
  
   
  
  
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
  
  
        }
      })
      .catch(function(error) {
        
        // If the promise rejects handle it by returning a standardized error
        // message to the controlled page.
        event.ports[0].postMessage({
          error: error.toString()
        });
      })
    );
});

// runs while an existing worker runs or nothing controls the page (update here)
//self.addEventListener('install', function (event) {
//  XXX CACHE SELF?
//});

// run active page, changes here (like deleting old cache) breaks page
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
      caches.open(CURRENT_CACHES['cribjs'])
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
  

// This polyfill provides Cache.add(), Cache.addAll(), and CacheStorage.match(),
// which are not implemented in Chrome 40.
// Should not be needed for Chromium > 47 And Firefox > 39
// See https://developer.mozilla.org/en-US/docs/Web/API/Cache
importScripts('./serviceworker-cache-polyfill.js');

// While overkill for this specific sample in which there is only one cache,
// this is one best practice that can be followed in general to keep track of
// multiple caches used by a given service worker, and keep them all versioned.
// It maps a shorthand identifier for a cache to a specific, versioned cache name.

// Note that since global state is discarded in between service worker restarts, these
// variables will be reinitialized each time the service worker handles an event, and you
// should not attempt to change their values inside an event handler. (Treat them as constants.)

// If at any point you want to force pages that use this service worker to start using a fresh
// cache, then increment the CACHE_VERSION value. It will kick off the service worker update
// flow and the old cache(s) will be purged as part of the activate event handler when the
// updated service worker is activated.
var CACHE_VERSION = 1;
var CURRENT_CACHES = {
  'cribjs': 'post-message-cache-v' + CACHE_VERSION
};
var URL_LIST;

self.addEventListener('activate', function(event) {
  // Delete all caches that aren't named in CURRENT_CACHES.
  // While there is only one cache in this example, the same logic will handle the case where
  // there are multiple versioned caches.
  var expectedCacheNames = Object.keys(CURRENT_CACHES).map(function(key) {
    return CURRENT_CACHES[key];
  });
  URL_LIST = {};
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (expectedCacheNames.indexOf(cacheName) == -1) {
            // If this cache name isn't present in the array of "expected" cache names, then delete it.
            console.log('Deleting out of date cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', function(event) {
  console.log('Handling fetch event for', event.request.url);
  if (event.request.method === "GET") {
    /// XXX Why is URL_LIST undefined in some cases???
    if (URL_LIST === undefined)
      URL_LIST = {};
    if (URL_LIST[event.request.url] === undefined) {
      URL_LIST[event.request.url] = {
        cached: false,
        request_number: 0,
        url: event.request.url,
        };
    }
    URL_LIST[event.request.url].request_number = URL_LIST[event.request.url].request_number + 1;
    event.respondWith(
      caches.open(CURRENT_CACHES['cribjs']).then(function(cache) {
        return cache.match(event.request).then(function(response) {
          if (response) {
            // If there is an entry in the cache for event.request, then response will be defined
            // and we can just return it. Note that in this example, only font resources are cached.
            console.log(' Found response in cache:', response.url);
            URL_LIST[event.request.url].cached = true;
            return response;
          } else {
            // Otherwise, if there is no entry in the cache for event.request, response will be
            // undefined, and we need to fetch() the resource.
            console.log(' No response for %s found in cache. About to fetch from network...', event.request.url);
            // We call .clone() on the request since we might use it in a call to cache.put() later on.
            // Both fetch() and cache.put() "consume" the request, so we need to make a copy.
            // (see https://fetch.spec.whatwg.org/#dom-request-clone)
            return fetch(event.request.clone()).then(function(response) {
              console.log('  Response for %s from network is: %O', event.request.url, response.url);
              // Return the original response object, which will be used to fulfill the resource request.
             //cache.put(event.request, response.clone());
              return response;
            });
          }
        }).catch(function(error) {
          // This catch() will handle exceptions that arise from the match() or fetch() operations.
          // Note that a HTTP error response (e.g. 404) will NOT trigger an exception.
          // It will return a normal response object that has the appropriate error code set.
          console.error('  Error in fetch handler:', error);

          throw error;
        });
      })
    );
  } else {
    event.respondWith(fetch(event.request));
  }
});

self.addEventListener('message', function(event) {
  var request;
  console.log('Handling message event:', event);
  // URL_LIST is a hack it should use a persistent object
  if (URL_LIST === undefined)
    URL_LIST = {};
  caches.open(CURRENT_CACHES['cribjs']).then(function(cache) {
    switch (event.data.command) {
      // This command returns a list of the URLs corresponding to the Request objects
      // that serve as keys for the current cache.
      case 'keys':
        cache.keys().then(function(requests) {
          var urls = requests.map(function(request) {
            return request.url;
          });

          // event.ports[0] corresponds to the MessagePort that was transferred as part of the controlled page's
          // call to controller.postMessage(). Therefore, event.ports[0].postMessage() will trigger the onmessage
          // handler from the controlled page.
          // It's up to you how to structure the messages that you send back; this is just one example.
          event.ports[0].postMessage({
            error: null,
            urls: urls.sort()
          });
        });
      break;
      
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

      // This command adds a new request/response pair to the cache.
      case 'add':
        // If event.data.url isn't a valid URL, new Request() will throw a TypeError which will be handled
        // by the outer .catch().
        // Hardcode {mode: 'no-cors} since the default for new Requests constructed from strings is to require
        // CORS, and we don't have any way of knowing whether an arbitrary URL that a user entered supports CORS.
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


    }
  }).catch(function(error) {
    // If the promise rejects, handle it by returning a standardized error message to the controlled page.
    console.error('Message handling failed:', error);

    event.ports[0].postMessage({
      error: error.toString()
    });
  });
});

  
  */
