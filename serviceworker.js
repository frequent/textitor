/**
 * JIO Service Worker Storage Backend.
 */

// this polyfill provides Cache.add(), Cache.addAll(), and CacheStorage.match(),
// should not be needed for Chromium > 47 And Firefox > 39
// see https://developer.mozilla.org/en-US/docs/Web/API/Cache
// importScripts('./serviceworker-cache-polyfill.js');

// https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
// http://www.html5rocks.com/en/tutorials/service-worker/introduction/

var CURRENT_CACHE_VERSION = 1;
var CURRENT_CACHE_DICT = {};
var URL_LIST = [];

// runs while an existing worker runs or nothing controls the page (update here)
//self.addEventListener('install', function (event) {
//  XXX CACHE SELF?
//});

// run active page, changes here (like deleting old cache) breaks page
self.addEventListener('activate', function (event) {
  var expectedCacheNames = Object.keys(CURRENT_CACHE_DICT).map(function(key) {
    return CURRENT_CACHE_DICT[key];
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

self.addEventListener('message', function (event) {
  var param = event.data,
    current_cache = CURRENT_CACHE_DICT[param.id],
    item,
    result_list;

  switch (param.command) {
    
    // case 'post' not possible
    // case 'remove' not necessary
    
    // test if cache exits
    case 'get':
      event.respondWith(

        // event.ports[0] corresponds to the MessagePort that was transferred as
        // part of the controlled page's call to controller.postMessage(). 
        // Therefore, event.ports[0].postMessage() will trigger the onmessage
        // handler from the controlled page. It's up to you how to structure the
        // messages that you send back; this is just one example.
        event.ports[0].postMessage({
          error: current_cache ? null : {
            "status_code": 404,
            "message": "Cache already exists"
          }
        })
      );
      break;

    // create new cache, will only run once per folder
    case 'put':
      if (current_cache === undefined) {
        CURRENT_CACHE_DICT[param.id] = 'post-message-cache-v' + CACHE_VERSION;
      }
      event.respondWith(
        event.ports[0].postMessage({
          error: null,
          data: param.id
        })
      );
    break;
    
    // return list of caches ~ folders
    case 'allDocs':
      for (item in CURRENT_CACHE_DICT) {
        if (CURRENT_CACHE_DICT.hasOwnProperty(item)) {
          result_list.push({
            "id": item,
            "value": {}
          });
        }
      }
      event.respondWith(
        event.ports[0].postMessage({
          error: null,
          data: {
            rows: result_list,
            total_rows: result_list.length
          }
        })
      );
    break;
    
    // return all urls stored in a cache
    case 'allAttachments':
      
      // returns a list of the URLs corresponding to the Request objects
      // that serve as keys for the current cache. We assume all files
      // are kept in cache, so there will be no network requests.

      event.respondWith(
        caches.open(current_cache)
          .then(function(cache) {
            cache.keys().then(function (request_list) {
              result_list = requests.map(function(request) {
                return request.url;
              }),
              attachment_dict = {},
              i, 
              i_len, 
              url;
                
              for (i = 0, i_len = result_list.length; i < i_len; i += 1) {
                url = result_list[i];

                // update URL_LIST
                if (URL_LIST[url] === undefined) {
                  URL_LIST[url] = {
                    cached: true,
                    request_number: 0,
                    url: url,
                  };
                }
                
                // build response object
                attachment_dict[url] = {};
              }
              event.ports[0].postMessage({
                error: null,
                data: attachment_dict
              });
            });
          })
          .catch(function(error) {
            event.ports[0].postMessage({
              error: {'message': error.toString()}
            });
          })
        );
    break;
  
    case 'removeAttachment':
      event.respondWith(
        caches.open(current_cache)
          .then(function(cache) {
            request = new Request(param.name, {mode: 'no-cors'});
            
            // flag as uncached
            if (URL_LIST[request.url] !== undefined) {
              URL_LIST[request.url].cached = false;
            }

            // remove from cache
            cache.delete(request)
              .then(function(success) {
                event.ports[0].postMessage({
                  error: success ? null : {
                    'status': 404,
                    'message': 'Item not found in cache.'
                  }
                });
              });
          })
          .catch(function(error) {
            event.ports[0].postMessage({
              error: {'message': error.toString()}
            });
          })
      );
    break;
    
    case 'getAttachment':
      event.respondWith(
        caches.open(current_cache)
          .then(function(cache) {
            return cache.match(param.name)
            .then(function(response) {
              if (response) {
                event.ports[0].postMessage({
                  error: null,
                  data: response
                });
              } else {
                event.ports[0].postMessage({
                  error: {
                    'status': 404,
                    'message': 'Item not found in cache.'
                  }
                });
              }
            });
          })
          .catch(function(error) {
            event.ports[0].postMessage({
              error: {'message': error.toString()}
            });
          })
      );
    break;  
      
    case 'putAttachment':
      event.respondWith(
        caches.open(current_cache)
          .then(function(cache) {
            
            // If event.data.url isn't a valid URL, new Request() will throw a 
            // TypeError which will be handled by the outer .catch().
            // Hardcode {mode: 'no-cors} since the default for new Requests 
            // constructed from strings is to require CORS, and we don't have any 
            // way of knowing whether an arbitrary URL that a user entered 
            // supports CORS.
            request = new Request(param.name, {mode: 'no-cors'}),
            response = new Response(param.content);
            
            // update URL_LIST
            if (URL_LIST[request.url] === undefined) {
              URL_LIST[request.url] = {
                cached: true,
                request_number: 0,
                url: request.url,
              };
            }
          
            // add to cache
            cache.put(request, response)
              .then(function() {
                event.ports[0].postMessage({
                  error: null
                });
              });
          })
          .catch(function(error) {
            event.ports[0].postMessage({
              error: {'message': error.toString()}
            });
          })
      );
    break;
    
    // refuse all else
    default:
      throw 'Unknown command: ' + event.data.command;
  }

});  
  
// ???????????????????






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

  */
