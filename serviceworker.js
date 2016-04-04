/**
 * JIO Service Worker Storage Backend.
 */

// this polyfill provides Cache.add(), Cache.addAll(), and CacheStorage.match(),
// should not be needed for Chromium > 47 And Firefox > 39
// see https://developer.mozilla.org/en-US/docs/Web/API/Cache
// importScripts('./serviceworker-cache-polyfill.js');

// debug:
// chrome://cache/
// chrome://inspect/#service-workers
// chrome://serviceworker-internals/
// 
// bar = new Promise(function (resolve, reject) {
//   return caches.keys()
//     .then(function (result) {
//      console.log(result);
//      return caches.open(result[0])
//        .then(function(cache){
//          return cache.keys()
//            .then(function (request_list) {
//              console.log(request_list);
//              console.log("DONE");
//              resolve();
//            });
//        });
//    });
//});

// https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
// http://www.html5rocks.com/en/tutorials/service-worker/introduction/

// versioning allows to keep a clean cache, current_cache is accessed on fetch
var CURRENT_CACHE_VERSION = 1;
var CURRENT_CACHE;

// runs while an existing worker runs or nothing controls the page (update here)
//self.addEventListener('install', function (event) {
//  XXX CACHE SELF?
//});

// runs active page, changes here (like deleting old cache) breaks page
self.addEventListener('activate', function (event) {
  
  // only validate against version, nothing else persists
  event.waitUntil(caches.keys()
    .then(function(cache_name_list) {
      return Promise.all(
        cache_name_list.map(function(cache_name) {
          version = cache_name.split("-v")[1];
          if (!(version && parseInt(version, 10) === CURRENT_CACHE_VERSION)) {
            return caches.delete(cache_name);
          }
        })
      );
    })
  );
});

// XXX build a server on fetch?
// intercept network requests, allows to serve form cache or fetch from network
/*
self.addEventListener('fetch', function (event) {
  var url = event.request.url;
  
  if (event.request.method === "GET") {
    event.respondWith(
      caches.open(CURRENT_CACHE)
        .then(function(cache) {
          return cache.match(event.request)
            .then(function(response) {
              if (response) {
                return response;
              
              // no cached response for event.request, fetch from network
              } else {
                
                // clone call, because any operation like fetch/put... will
                // consume the request, so we need a copy of the original
                // (see https://fetch.spec.whatwg.org/#dom-request-clone)
                return fetch(event.request.clone()).then(function(response) {

                  // add resource to cache
                  cache.put(event.request, response.clone())
                    .then(function() {
                      return response;
                    });
                });
              }
            })
            .catch(function(error) {
              
              // This catch() will handle exceptions that arise from the match()
              // or fetch() operations. Note that a HTTP error response (e.g.
              // 404) will NOT trigger an exception. It will return a normal 
              // response object that has the appropriate error code set.
              throw error;
            });
      })
    );
  
  // we could also handle post with indexedDB here
  } else {
    event.respondWith(fetch(event.request));
  }
});
*/

self.addEventListener('message', function (event) {
  var param = event.data,
    item,
    result_list;

  switch (param.command) {
    
    // case 'post' not possible
    // case 'remove' not necessary
    
    // test if cache exits, only run ahead of put
    case 'get':
      caches.keys().then(function(key_list) {
        var i, len;
        CURRENT_CACHE = param.id + "-v" + CURRENT_CACHE_VERSION;
        for (i = 0, len = key_list.length; i < len; i += 1) {
          if (key_list[i] === CURRENT_CACHE) {
            event.ports[0].postMessage({
              error: null
            });
          }
        }
      
        // event.ports[0] corresponds to the MessagePort that was transferred 
        // as part of the controlled page's call to controller.postMessage(). 
        // Therefore, event.ports[0].postMessage() will trigger the onmessage
        // handler from the controlled page. It's up to you how to structure 
        // the messages that you send back; this is just one example.
        event.ports[0].postMessage({
          error: {
            "status": 404,
            "message": "Cache does not exist."
          }
        });
      })
      .catch(function(error) {
        event.ports[0].postMessage({
          error: {'message': error.toString()}
        });
      });

      break;

    // create new cache by opening it. this will only run once per cache/folder
    case 'put':
      CURRENT_CACHE = param.id + "-v" + CURRENT_CACHE_VERSION;
      caches.open(CURRENT_CACHE)
        .then(function() {
          event.ports[0].postMessage({
            error: null,
            data: param.id
          });
        })
        .catch(function(error) {
          event.ports[0].postMessage({
            error: {'message': error.toString()}
          });
        });
    break;

    // return list of caches ~ folders
    case 'allDocs':
      caches.keys().then(function(key_list) {
        result_list = key_list.map(function(key) {
          return {
            "id": key.split("-v")[0],
            "value": {}
          };
        });
        event.ports[0].postMessage({
          error: null,
          data: {
            rows: result_list,
            total_rows: result_list.length
          }
        });
      })
      .catch(function(error) {
        event.ports[0].postMessage({
          error: {'message': error.toString()}
        });
      });
    break;
    
    // return all urls stored in a cache
    case 'allAttachments':
      CURRENT_CACHE = param.id + "-v" + CURRENT_CACHE_VERSION;

      // returns a list of the URLs corresponding to the Request objects
      // that serve as keys for the current cache. We assume all files
      // are kept in cache, so there will be no network requests.

      caches.open(CURRENT_CACHE)
        .then(function(cache) {
          cache.keys()
          .then(function (request_list) {
            var result_list = request_list.map(function(request) {
              return request.url;
            }),
              attachment_dict = {},
              i, 
              len;
              
            for (i = 0, len = result_list.length; i < len; i += 1) {
              attachment_dict[result_list[i]] = {};
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
        });
    break;
  
    case 'removeAttachment':
      CURRENT_CACHE = param.id + "-v" + CURRENT_CACHE_VERSION;

      caches.open(CURRENT_CACHE)
        .then(function(cache) {
          request = new Request(param.name, {mode: 'no-cors'});
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
        });
    break;

    case 'getAttachment':
      CURRENT_CACHE = param.id + "-v" + CURRENT_CACHE_VERSION;
      caches.open(CURRENT_CACHE)
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
        });
    break;  
      
    case 'putAttachment':
      CURRENT_CACHE = param.id + "-v" + CURRENT_CACHE_VERSION;
      caches.open(CURRENT_CACHE)
        .then(function(cache) {
          
          // If event.data.url isn't a valid URL, new Request() will throw a 
          // TypeError which will be handled by the outer .catch().
          // Hardcode {mode: 'no-cors} since the default for new Requests 
          // constructed from strings is to require CORS, and we don't have any 
          // way of knowing whether an arbitrary URL that a user entered 
          // supports CORS.
          request = new Request(param.name, {mode: 'no-cors'}),
          response = new Response(param.content);
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
        });
    break;
    
    // refuse all else
    default:
      throw 'Unknown command: ' + event.data.command;
  }
});  

