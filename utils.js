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
// Utilities for use in background pages and content scripts.


// Makes functions in a background page callable from a content script or vice
// versa, using the message system.  Each function should take a callback as
// its last argument and call the callback with its result.  For example:
//
// In background page:
//   provideFunctions({add: function (x, y, callback) { callback(x + y); }});
// In content script:
//   callBackgroundPage('square', 3, 5, alert);
//
// In content script:
//   provideFunctions({add: function (x, y, callback) { callback(x + y); }});
// In background page:
//   callContentScript(1, 'square', 3, 5, alert);
function provideFunctions(functions) {
  chrome.extension.onMessage.addListener(function (request, sender, callback) {
    var func = functions[request.verb];
    func && func.apply(null, request.args.concat([callback]));
    return true;
  });
}

// Calls a function provided by a background page, from within a content script.
// The first argument is the function name, the last is a callback to be called
// with the result, and the rest of the arguments in between should correspond
// to the rest of the arguments in the definition passed to provideFunctions.
function callBackgroundPage(verb, varargs) {
  var args = Array.prototype.slice.call(arguments, 1);
  var callback = args.pop();
  chrome.extension.sendMessage({verb: verb, args: args}, callback);
}

// Calls a function provided by a content script, from within a background page.
// The first two arguments are the tab ID and function name, the last is a
// callback for the result, and the rest of the arguments should correspond to
// to the rest of the arguments in the definition passed to provideFunctions.
function callContentScript(tabId, verb, varargs) {
  var args = Array.prototype.slice.call(arguments, 2);
  var callback = args.pop();
  chrome.tabs.sendMessage(tabId, {verb: verb, args: args}, callback);
}

// Makes an XHR to the given URL, calling the callback with the JSON-parsed
// result or with null on error.  Uses GET if 'data' is null, POST otherwise.
// For this to work, the URL must be allowed by "permissions" in manifest.json.
function jsonRequest(url, data, callback) {
  var result = null;
  xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        try {
          result = JSON.parse(xhr.responseText);
        } catch (e) { }
      }
      callback(result);
    }
  };
  xhr.open(data === null ? 'GET' : 'POST', url);
  xhr.send(data);
}

// Loads a stylesheet from a CSS file in the extension into the current page.
function loadStylesheet(path) {
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.extension.getURL(path);
  document.getElementsByTagName('head')[0].appendChild(link);
}
