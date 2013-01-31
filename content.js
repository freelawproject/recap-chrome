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


loadStylesheet('style.css');

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
