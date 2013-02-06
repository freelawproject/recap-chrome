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
// Content script to run when the DOM finishes loading (run_at: "document_end").


var url = window.location.href;
var court = recap.getCourtFromUrl(url);

// If this is a docket query page, ask RECAP whether it has the docket page.
if (recap.isDocketQueryPage(url)) {
  callBackgroundPage('getMetadataForCase', court,
                     recap.getDocketQueryCaseNumber(url), function (result) {
    if (result && result.docket_url) {
      // Insert a RECAP download link at the bottom of the form.
      $('<div class="recap-banner"/>').append(
        $('<a/>', {
          title: 'Docket is available for free from RECAP.',
          href: result.docket_url
        }).append(
          $('<img/>', {src: chrome.extension.getURL('icon-16.png')})
        ).append(
          ' Get this docket as of ' + result.timestamp + ' for free from RECAP.'
        )
      ).append(
        $('<br><small>Note that archived dockets may be out of date.</small>')
      ).appendTo($('form'));
    }
  });
}

if (recap.isDocketPage(url, document)) {
  var casenum = recap.getDocketQueryCaseNumber(document.referrer);
  recap.uploadDocket(court, casenum, 'DktRpt.html', 'text/html',
                     document.documentElement.innerHTML, function (text) {
    if (text && text.match(/successfully parsed/i)) {
      callBackgroundPage('showNotification', 'RECAP upload',
                         'Docket uploaded to the public archive.', null);
    } else {
      callBackgroundPage('showNotification', 'RECAP problem',
                         'Docket was not accepted by RECAP: ' + text, null);
    }
  });
}

// If this page offers a single document, ask RECAP whether it has the document.
if (recap.isSingleDocumentPage(url, document)) {
  callBackgroundPage('getMetadataForDocuments', [url], function (result) {
    if (result && result[url]) {
      // Insert a RECAP download link at the bottom of the form.
      $('<div class="recap-banner"/>').append(
        $('<a/>', {
          title: 'Document is available for free from RECAP.',
          href: result[url].filename
        }).append(
          $('<img/>', {src: chrome.extension.getURL('icon-16.png')})
        ).append(
          ' Get this document for free from RECAP.'
        )
      ).appendTo($('form'));
    }
  });
}

// Scan the document for all the links and collect the URLs we care about.
var links = document.body.getElementsByTagName('a');
var urls = [];
for (var i = 0; i < links.length; i++) {
  if (recap.isDocumentUrl(links[i].href)) {
    urls.push(links[i].href);
  }
}
if (urls.length) {
  // Ask the server whether any of these documents are available from RECAP.
  callBackgroundPage('getMetadataForDocuments', urls, function (result) {
    // When we get a reply, update all the links that have documents available.
    for (var i = 0; i < links.length; i++) {
      if (links[i].href in result) {
        // Insert a RECAP button just after the original link.
        $('<a/>', {
          'class': 'recap-inline',
          title: 'Available for free from RECAP.',
          href: result[links[i].href].filename
        }).append(
          $('<img/>').attr({src: chrome.extension.getURL('icon-16.png')})
        ).insertAfter(links[i]);
      }
    }
  });
}

// If this page offers a single document, intercept navigation to the document
// view page.  The "View Document" button calls the goDLS() function, which
// creates a <form> element and calls submit() on it, so we hook into submit().
if (recap.isSingleDocumentPage(url, document)) {
  // Monkey-patch the <form> prototype so that its submit() method sends a
  // message to this content script instead of submitting the form.  To do this
  // in the page context instead of this script's, we inject a <script> element.
  var script = document.createElement('script');
  script.innerText =
      'document.createElement("form").__proto__.submit = function () {' +
      '  this.id = "form" + new Date().getTime();' +
      '  window.postMessage({id: this.id}, "*");' +
      '};';
  document.body.appendChild(script);

  // When we receive the message from the above submit method, submit the form
  // via XHR and modify the received document before showing it in the browser.
  window.addEventListener('message', function (event) {
    // Save a copy of the page source, altered so that the "View Document"
    // button goes forward in the history instead of resubmitting the form.
    var originalSubmit = document.forms[0].getAttribute('onsubmit');
    document.forms[0].setAttribute(
        'onsubmit', 'history.forward(); return false;');
    var previousPageHtml = document.documentElement.innerHTML;
    document.forms[0].setAttribute('onsubmit', originalSubmit);
    var docPath = window.location.pathname;
    
    // Now do the form request to get to the view page.
    $('body').css('cursor', 'wait');
    var form = document.getElementById(event.data.id);
    httpRequest(form.action, new FormData(form), '', function (type, html) {
      // Find the <iframe> URL in the document view page.
      var match = html.match(/([^]*?)<iframe[^>]*src="(.*?)"([^]*)/);
      if (!match) {
        document.documentElement.innerHTML = html;
        return;
      }

      // Show the page with a blank <iframe> while waiting for the download.
      document.documentElement.innerHTML =
        match[1] + '<iframe src="about:blank"' + match[3];

      // Download the file from the <iframe> URL.
      var doc = httpRequest(match[2], null, 'arraybuffer', function (type, ab) {
        // For unknown reasons, if we get a Blob directly from the XHR with
        // responseType 'blob', the Blob doesn't upload below.  But if we get
        // an ArrayBuffer and then convert it to a Blob, the upload works.
        var blob = new Blob([new Uint8Array(ab)], {type: type});
        var blobUrl = URL.createObjectURL(blob);

        // Make the Back button redisplay the previous page.
        window.onpopstate = function(event) {
          if (event.state.content) {
            document.documentElement.innerHTML = event.state.content;
          }
        };
        history.replaceState({content: previousPageHtml});

        // Display the page with the downloaded file in the <iframe>.
        html = match[1] + '<iframe src="' + blobUrl + '"' + match[3];
        document.documentElement.innerHTML = html;
        history.pushState({content: html});

        // Upload the file to RECAP.
        var name = docPath.match(/[^\/]+$/)[0] + '.pdf';
        recap.uploadDocument(court, docPath, name, type, blob, function (text) {
          if (text && text.match(/uploaded/i)) {
            callBackgroundPage('showNotification', 'RECAP upload',
                               'PDF uploaded to the public archive.', null);
          } else {
            callBackgroundPage('showNotification', 'RECAP problem',
                               'PDF was not accepted by RECAP: ' + text, null);
          }
        });
      });
    });
  }, false);
}
