// This file is part of RECAP for Chrome.
// Copyright 2013 Ka-Ping Yee <ping@zesty.ca>
//
// RECAP for Chrome is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version.
// 
// RECAP for Chrome is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
// for more details.
// 
// You should have received a copy of the GNU General Public License along with
// RECAP for Chrome.  If not, see: http://www.gnu.org/licenses/

// -------------------------------------------------------------------------
// Browser-specific utilities for use in background pages and content scripts.


// Makes a singleton instance in a background page callable from a content
// script, using Chrome's message system.  The constructor should be a named
// no-argument function that returns an object whose methods all take a
// callback (cb) as the last argument and call the callback with the return
// value (rv).  Arguments and return values must be JSON-serializable values
// (due to the restrictions of Chrome's message system).  For example:
//
// In background page:
//   function Counter() {
//     var count = 0;
//     return {inc: function (amount, cb) { cb(count += amount); }};
//   }
//   exportInstance(Counter);
//
// In content script:
//   var counter = importInstance(Counter);
//   counter.inc(6, function (rv) { alert('count is ' + rv); });
function exportInstance(constructor) {
  var name = constructor.name;  // function name is used to identify the service
  var instance = new constructor();
  chrome.extension.onMessage.addListener(function (request, sender, cb) {
    if (request.name === name) {
      var pack = function () { cb(Array.prototype.slice.apply(arguments)); };
      instance[request.verb].apply(instance, request.args.concat([pack]));
      return true;  // allow cb to be called after listener returns
    }
  });
};

// Gets an object that corresponds to the instance exported by exportInstance.
// Calling methods on this object in a content script will invoke the methods
// on a singleton instance of the constructor the background page.  All calls
// must provide a callback function or null as the last argument.  The
// constructor should be the same one passed to exportInstance.
function importInstance(constructor) {
  var name = constructor.name;
  var sender = {};
  for (var verb in new constructor()) {
    (function (verb) {
      sender[verb] = function () {
        var args = Array.prototype.slice.call(arguments, 0, -1);
        var cb = arguments[arguments.length - 1] || function () {};
        var unpack = function (results) { cb.apply(null, results); };
        chrome.extension.sendMessage(
          {name: name, verb: verb, args: args}, unpack);
      };
    })(verb);
  }
  return sender;
}

// Makes an XHR to the given URL, calling a callback with the returned content
// type and response (interpreted according to responseType).  See XHR2 spec
// for details on responseType and response.  Uses GET if postData is null or
// POST otherwise.  postData can be any type accepted by XMLHttpRequest.send().
function httpRequest(url, postData, responseType, callback) {
  var type = null;
  var result = null;
  var xhr = new XMLHttpRequest();
  // WebKit doesn't support responseType 'json' yet, but probably will soon.
  xhr.responseType = responseType === 'json' ? 'text' : responseType;
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        type = xhr.getResponseHeader('Content-Type');
        result = xhr.response;
        if (responseType === 'json') {
          try {
            result = JSON.parse(result);
          } catch (e) { }
        }
      }
      callback && callback(type, result);
    }
  };
  xhr.open(postData === null ? 'GET' : 'POST', url);
  xhr.send(postData);
}
