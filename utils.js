// -------------------------------------------------------------------------
// Browser-specific utilities for use in background pages and content scripts.


// In Chrome, content scripts can only communicate with background pages using
// message passing (see http://developer.chrome.com/extensions/messaging.html).
// Sometimes the content script needs to call into a background page in order
// to persist data from page to page or to use certain permissions, so for
// convenience we wrap the message-passing machinery using a pair of functions,
// exportInstance() and importInstance().  Here's how to use them:
//
// 1. Write a service by defining a no-argument constructor function.  The
//    name of the function identifies the service.  The function should return
//    an object whose methods all take a callback (cb) as the last argument and
//    call the callback with the return value (rv).  All arguments and return
//    values must be JSON-serializable.  The caller's tab is provided as cb.tab.
//
// 2. Include the service in both the background page and the content script
//    (i.e. in manifest.json, the service's JS file should appear in both the
//    background: {scripts: [...]} and content_scripts: {js: [...]} lists).
//
// 3. In the background page, call exportInstance on the constructor).  This
//    creates a instance that will serve requests from the content script.
//    Only one singleton instance can be exported.
//
// 4. In the content script, call importInstance on the same constructor to get
//    an object.  Then call methods on the object, always passing a callback
//    function or null as the last argument.
//
// Here's an example.
//
// Service definition:
//   function Counter() {
//     var count = 0;
//     return {inc: function (amount, cb) { cb(count += amount); }};
//   }
//
// In the background page:
//   exportInstance(Counter);
//
// In the content script:
//   var counter = importInstance(Counter);
//   counter.inc(6, function (rv) { alert('count is ' + rv); });

// Makes a singleton instance in a background page callable from a content
// script, using Chrome's message system.  See above for details.
function exportInstance(constructor) {
  let name = constructor.name;  // function name identifies the service
  let instance = new constructor();
  chrome.runtime.onMessage.addListener(function (request, sender, cb) {
    if (request.name === name) {
      let pack = function () { cb(Array.prototype.slice.apply(arguments)); };
      pack.tab = sender.tab;
      instance[request.verb].apply(instance, request.args.concat([pack]));
      return true;  // allow cb to be called after listener returns
    }
  });
}

// Gets an object that can be used in a content script to invoke methods on an
// instance exported from the background page.  See above for details.
function importInstance(constructor) {
  var name = constructor.name;
  var sender = {};
  for (var verb in new constructor()) {
    (function (verb) {
      sender[verb] = function () {
        var args = Array.prototype.slice.call(arguments, 0, -1);
        var cb = arguments[arguments.length - 1] || function () {};
        if (typeof cb !== 'function') {
          throw 'Service invocation error: last argument is not a callback';
        }
        var unpack = function (results) { cb.apply(null, results); };
        chrome.runtime.sendMessage(
          {name: name, verb: verb, args: args}, unpack);
      };
    })(verb);
  }
  return sender;
}

function getHostname(url){
  // Extract the hostname from a URL.
  return $('<a>').prop('href', url).prop('hostname');
}

// Makes an XHR to the given URL, calling a callback with the returned content
// type and response (interpreted according to responseType).  See XHR2 spec
// for details on responseType and response.  Uses GET if postData is null or
// POST otherwise.  postData can be any type accepted by XMLHttpRequest.send().
function httpRequest(url, postData, callback) {
  let type = null,
      result = null,
      xhr;

    // Firefox requires a special call to get an XMLHttpRequest() that
    // sends Referer headers, which is CMECF needs because of their
    // choice in how to fix the 2017 cross-site/same-origin security
    // vulnerability.
    try {
        // Firefox. See: https://discourse.mozilla.org/t/webextension-xmlhttprequest-issues-no-cookies-or-referrer-solved/11224/18
        xhr = XPCNativeWrapper(new window.wrappedJSObject.XMLHttpRequest());
    }
    catch (evt) {
        // Chrome.
        xhr = new XMLHttpRequest();
    }

  xhr.responseType = 'arraybuffer';
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        type = xhr.getResponseHeader('Content-Type');
        result = xhr.response;
      }
      callback && callback(type, result, xhr);
    }
  };
  if (postData) {
    xhr.open('POST', url);
    xhr.send(postData);
  } else {
    xhr.open('GET', url);
    xhr.send();
  }
}

// Default settings for any jquery $.ajax call.
$.ajaxSetup({
  // The dataType parameter is a security measure requested by Opera code
  // review. 'json' is the default, but if it is not explicitly set, and if the
  // CourtListener server was hacked, the API could be used to serve JSONP to
  // our users. If the server did that, all of our users would be at risk of
  // running custom JavaScript. We don't want that, so we set this explicitly.
  dataType: 'json',
  beforeSend: function (xhr, settings) {
    let hostname = getHostname(settings.url);
    if (hostname === "www.courtlistener.com") {
        // If you are reading this code, we ask that you please refrain from
        // using this token. Unfortunately, there is no way to distribute
        // extensions that use hardcoded tokens except through begging and using
        // funny variable names. Do not abuse the RECAP service.
        let asdf = '45c7946dd8400ad62662565cf79da3c081d9b0e5';
        xhr.setRequestHeader("Authorization", `Token ${asdf}`);
    }
  }
});


// Converts an ArrayBuffer to a regular array of unsigned bytes.  Array.apply()
// causes a "maximum call stack size exceeded" error for buffers of only 300k,
// so we need this ridiculous circumlocution of breaking the data into chunks.
function arrayBufferToArray(ab) {
  let chunks = [];
  for (let i = 0; i < ab.byteLength; i += 100000) {
    let slice = new Uint8Array(ab, i, Math.min(100000, ab.byteLength - i));
    chunks.push(Array.apply(null, slice));  // convert each chunk separately
  }
  return [].concat.apply([], chunks);  // concatenate all the chunks together
}

// Debug logging function. First argument is a debug level, remainder are variable args
// for console.log(). If the global debug level matches the first arg, calls console.log().
// Example usage:
//    debug(5, "This message is only seen when the debug level is %d or higher.", 5);
// Debug levels:
//   1   General informational
//   3   Developer debugging
var DEBUGLEVEL = 4;
function debug(level, varargs) {
  if (DEBUGLEVEL >= level) {
    var args = Array.prototype.slice.call(arguments, 1);
    args[0] = `RECAP debug [${level}]: `+args[0];
    return console.log.apply(this, args);
  }
}
