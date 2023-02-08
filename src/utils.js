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
        var cb = arguments[arguments.length - 1] || function () { };
        if (typeof cb !== 'function') {
          throw 'Service invocation error: last argument is not a callback';
        }
        var unpack = function (results) { cb.apply(null, results); };
        chrome.runtime.sendMessage(
          { name: name, verb: verb, args: args }, unpack);
      };
    })(verb);
  }
  return sender;
}

function getHostname(url) {
  // Extract the hostname from a URL.
  return $('<a>').prop('href', url).prop('hostname');
}


// Gets the CL Id from the absolute URL attribute found in the response
// of the getAvailabilityForDocket request. An example of this URL is:
//
//    /docket/65757697/mohammad/
//
// this function will return: 
//
//   65757697
//
function getClIdFromAbsoluteURL(absoluteURL){
  // this will match the sequence of digits in the absolute URL
  return absoluteURL.match(/\d+/)[0]
}

// Makes an XHR to the given URL, calling a callback with the returned content
// type and response (interpreted according to responseType).  See XHR2 spec
// for details on responseType and response.  Uses GET if postData is null or
// POST otherwise.  postData can be any type accepted by XMLHttpRequest.send().
function httpRequest(url, postData, contentType, callback) {
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
    if (contentType){
      xhr.setRequestHeader("Content-Type", contentType);
    }
    xhr.send(postData);
  } else {
    xhr.open('GET', url);
    if (contentType){
      xhr.setRequestHeader("Content-Type", contentType);
    }
    xhr.send();
  }
}

// make token available to helper functions
var N87GC2 = "45c7946dd8400ad62662565cf79da3c081d9b0e5"

// helper functions for chrome local storage

var getItemsFromStorage = (key) => new Promise((resolve, reject) => {
  const stringKey = typeof key === 'number' ? key.toString() : key;
  chrome.storage.local.get(stringKey, result => {
    resolve(result[stringKey]);
  })
})

var saveItemToStorage = (dataObj) => new Promise((resolve, reject) =>
  chrome.storage.local.set(
    dataObj,
    () => resolve(
      console.log(`RECAP: Item saved in storage at tabId: ${Object.keys(dataObj)[0]}`)
    )
  )
);

var destroyTabStorage = key => {
  chrome.storage.local.get(null, store => {
    if (store[key]) {
      chrome.storage.local.remove(
        key.toString(),
        () => console.log(`Removed item from storage with key ${key}`)
      )
    }
  })
}
// initialize the store with an empty object
var getTabIdForContentScript = () => new Promise(resolve => {
  chrome.runtime.sendMessage(
    { message: 'requestTabId' },
    (msg) => resolve(msg)
  );
});

// object takes shape of { [tabId]: { ...data } }
var updateTabStorage = async object => {
  const tabId = Object.keys(object)[0];
  const updatedVars = object[tabId];
  const store = await getItemsFromStorage(tabId);
  // keep store immutable
  saveItemToStorage({ [tabId]: { ...store, ...updatedVars } });
};

// Save case_id in the chrome local storage
var saveCaseIdinTabStorage = async (object, case_id) => {
  const { tabId } = object;
  const payload = {
    caseId: case_id,
  };
  await updateTabStorage({
    [tabId]: payload
  })
}

// Save a cookie in document.cookie to let the extension know that the user has filing rights
var setFilingState = () => {
  document.cookie = "isFilingAccount=true;path=/;domain=.uscourts.gov";
}

// Reset the value of the cookie related to the filing rights of a user
var removeFilingState = () => {
  document.cookie = "isFilingAccount=false;path=/;domain=.uscourts.gov";
}

// converts an ISO-8601 date str to 'MM/DD/YYYY' format
function pacerDateFormat(date) {
  return date.replace(/(\d+)-(\d+)-(\d+)/, "$2/$3/$1");
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
      xhr.setRequestHeader("Authorization", `Token ${N87GC2}`);
    }
  }
});

var blobToDataURL = (blob) => {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
};

// Debug logging function. First argument is a debug level, remainder are variable args
// for console.log(). If the global debug level matches the first arg, calls console.log().
// Example usage:
//    debug(5, "This message is only seen when the debug level is %d or higher.", 5);
// Debug levels:
//   1   General informational
//   3   Developer debugging
var DEBUGLEVEL = 1;
function debug(level, varargs) {
  if (DEBUGLEVEL >= level) {
    var args = Array.prototype.slice.call(arguments, 1);
    args[0] = `RECAP debug [${level}]: ` + args[0];
    return console.log.apply(this, args);
  }
}

// inject a "follow this case on RECAP" button
var recapAlertButton = (court, pacerCaseId, isActive) => {
  const anchor = document.createElement('a');
  anchor.setAttribute('id', 'recap-alert-button');
  anchor.setAttribute('role', 'button');
  anchor.setAttribute('aria-disabled', isActive ? 'true' : false);
  if (!isActive) { anchor.classList.add('disabled'); };

  const icon = isActive ? 'icon' : 'grey';
  const text = isActive
    ? 'Create an Alert for this Case on RECAP'
    : 'Alerts not yet Supported for this Docket';

  var url = new URL('https://www.courtlistener.com/alert/docket/new/');
  url.searchParams.append('pacer_case_id', pacerCaseId);
  url.searchParams.append('court_id', court);
  anchor.href = url.toString();
  
  const img = document.createElement('img');
  img.src = chrome.extension.getURL(`assets/images/${icon}-16.png`);

  const p = document.createElement('p')
  p.innerHTML = text
  
  const innerDiv = document.createElement('div')
  innerDiv.classList.add("recap-banner-inner-div");
  
  innerDiv.appendChild(img)
  innerDiv.appendChild(p)

  anchor.append(innerDiv)
  
  return anchor;
};

// Creates an anchor element to autofill the Docket Query form
var recapAddLatestFilingButton = (result) => {
  let date = result.date_last_filing;
  let formatted_date = pacerDateFormat(date)

  const anchor = document.createElement('a');
  anchor.classList.add('recap-filing-button');
  anchor.title = 'Autofill the form to get the latest content not yet in RECAP, omitting parties and member cases.';
  anchor.setAttribute('data-date_from', formatted_date);
  anchor.href = '#';

  const img = document.createElement('img');
  img.src = chrome.extension.getURL('assets/images/icon-16.png');

  anchor.appendChild(img);

  anchor.onclick = function (e) {
    let target = e.currentTarget || e.target;

    let dateInput = document.querySelector("[name='date_from']");
    let partyCheckbox = document.getElementById('list_of_parties_and_counsel');
    let filedCheckbox = document.querySelector('input[value="Filed"]');
    let terminatedParties = document.getElementById('terminated_parties');

    dateInput.value = target.dataset.date_from;
    partyCheckbox.checked = false;
    terminatedParties.checked = false;
    filedCheckbox.checked = true;

    return false;
  };

  return anchor;
};

// Creates a div element to show a docket is available for free  
var recapBanner = (result) => {
  const div = document.createElement('div');
  div.setAttribute('class', 'recap-banner');

  const anchor = document.createElement('a');
  anchor.title = 'Docket is available for free in the RECAP Archive.';
  anchor.target = '_blank';
  anchor.href = `https://www.courtlistener.com${result.absolute_url}`
  const img = document.createElement('img');
  img.src = chrome.extension.getURL('assets/images/icon-16.png');
  const time = document.createElement('time');
  time.setAttribute('data-livestamp', result.date_modified);
  time.setAttribute('title', result.date_modified);
  time.innerHTML = result.date_modified;
  
  const p = document.createElement('p')
  p.innerHTML = `View and Search this docket as of ${time.outerHTML} for free from RECAP`;

  const small = document.createElement('small');
  small.innerText = 'Note that archived dockets may be out of date';

  const innerDiv = document.createElement('div')
  innerDiv.classList.add("recap-banner-inner-div");

  innerDiv.appendChild(img)
  innerDiv.appendChild(p)

  anchor.append(innerDiv)

  div.appendChild(anchor);
  div.appendChild(document.createElement('br'));
  div.appendChild(small);
  return div;
};

// Creates a div element to advertise RECAP email
var recapEmailBanner = (css_class = 'recap-email-banner') => {
  const div = document.createElement('div');
  div.setAttribute('class', css_class);

  const anchor = document.createElement('a');
  anchor.target = '_blank';
  anchor.href = `https://www.courtlistener.com/help/recap/email/`

  const innerDiv = document.createElement('div')
  innerDiv.classList.add("recap-banner-inner-div");

  const img = document.createElement('img');
  img.src = chrome.extension.getURL('assets/images/icon-16.png');

  const p = document.createElement('p')
  p.innerHTML = 'Use @recap.email to automatically contribute all your cases to RECAP.'

  innerDiv.appendChild(img)
  innerDiv.appendChild(p)
  
  anchor.appendChild(innerDiv)
  div.appendChild(anchor);
  return div
}

// Creates a div element to show a document is available for free in RECAP archive
var insertAvailableDocBanner = (doc_url, html_element) =>{
  let href = `https://storage.courtlistener.com/${doc_url}`;
  // Insert a RECAP download link at the bottom of the form.
  $('<div class="recap-banner"/>')
    .append(
      $('<a/>', {
        title: 'Document is available for free in the RECAP Archive.',
        href: href,
      })
        .append($('<img/>', { src: chrome.extension.getURL('assets/images/icon-16.png') }))
        .append(' Get this document for free from the RECAP Archive.')
    )
    .appendTo($(html_element));
}

//Given a pacer_doc_id, return the pacer_case_id that it is associated with
async function getPacerCaseIdFromPacerDocId(tabId, pacer_doc_id) {
  const tabStorage = await getItemsFromStorage(tabId);

  const docsToCases = tabStorage && tabStorage.docsToCases;
  if (!docsToCases) return;

  const caseId = docsToCases[pacer_doc_id];
  if (!caseId) return console.warn('No pacer_case_id found in storage');

  const success = `RECAP: Got case number ${caseId} for docId ${pacer_doc_id}`;
  console.info(success);
  return caseId;
}