// This file is part of RECAP for Chrome.
// Copyright 2013 Ka-Ping Yee <ping@zesty.ca>
//
// RECAP for Chrome is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version.  RECAP for Chrome is distributed in the hope that it will
// be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General
// Public License for more details.
//
// You should have received a copy of the GNU General Public License along with
// RECAP for Chrome.  If not, see: http://www.gnu.org/licenses/

// -------------------------------------------------------------------------
// Content script to run when DOM finishes loading (run_at: "document_end").


var notifier = importInstance(Notifier);
var toolbar_button = importInstance(ToolbarButton);
var pacer = importInstance(Pacer);
var recap = importInstance(Recap);

var url = window.location.href;
var path = window.location.pathname;
var court = PACER.getCourtFromUrl(url);
var casenum = PACER.getCaseNumberFromUrl(document.referrer);
var docid = PACER.getDocumentIdFromUrl(url);

// Update the toolbar button with knowledge of whether the user is logged in.
toolbar_button.updateCookieStatus(court, document.cookie, null);

// Create a delegate for handling the various states we might be in.
var content_delegate = new ContentDelegate(url, path, court, casenum, docid);

// If this is a docket query page, ask RECAP whether it has the docket page.
content_delegate.handleDocketQueryUrl();

// If this is a docket page, upload it to RECAP.
content_delegate.handleDocketDisplayPage();

// If this is a document's menu of attachments (subdocuments), upload it to
// RECAP.
content_delegate.handleAttachmentMenuPage();

// If this page offers a single document, ask RECAP whether it has the document.
content_delegate.handleSingleDocumentPageCheck();

// If this page offers a single document, intercept navigation to the document
// view page.  The "View Document" button calls the goDLS() function, which
// creates a <form> element and calls submit() on it, so we hook into submit().
content_delegate.handleSingleDocumentPageView();

// Scan the document for all the links and collect the URLs we care about.
var links = document.body.getElementsByTagName('a');
var urls = [];
for (var i = 0; i < links.length; i++) {
  if (PACER.isDocumentUrl(links[i].href)) {
    urls.push(links[i].href);
  }
  links[i].addEventListener('mouseover', function () {
    if (PACER.isConvertibleDocumentUrl(this.href)) {
      pacer.convertDocumentUrl(
        this.href,
        function (url, docid, caseid, de_seq_num, dm_id, docnum) {
          recap.uploadMetadata(
            court, docid, caseid, de_seq_num, dm_id, docnum, null);
        }
      );
    }
  });
}

// Pop up a dialog offering the link to the free cached copy of the document,
// or just go directly to the free document if popups are turned off.
function handleClick(url, uploadDate) {
  chrome.storage.sync.get('options', function (items) {
    if (!items.options.recap_link_popups) {
      window.location = url;
      return;
    }
    $('<div id="recap-shade"/>').appendTo($('body'));
    $('<div class="recap-popup"/>').append(
      $('<a/>', {
        'class': 'recap-close-link',
        href: '#',
        onclick: 'var d = document; d.body.removeChild(this.parentNode); ' +
          'd.body.removeChild(d.getElementById("recap-shade")); return false'
      }).append(
        '\u00d7'
      )
    ).append(
      $('<a/>', {
        href: url,
        onclick: 'var d = document; d.body.removeChild(this.parentNode); ' +
          'd.body.removeChild(d.getElementById("recap-shade"))'
      }).append(
        ' Get this document as of ' + uploadDate + ' for free from RECAP.'
      )
    ).append(
      $('<br><br><small>Note that archived documents may be out of date. ' +
        'RECAP is not affiliated with the U.S. Courts. The documents ' +
        'it makes available are voluntarily uploaded by PACER users. ' +
        'RECAP cannot guarantee the authenticity of documents because the ' +
        'courts themselves provide no document authentication system.</small>')
    ).appendTo($('body'));
  });
  return false;
}

if (urls.length) {
  // Ask the server whether any of these documents are available from RECAP.
  recap.getAvailabilityForDocuments(urls, function (result) {
    // When we get a reply, update all links that have documents available.
    for (var i = 0; i < links.length; i++) {
      (function (info) {
        if (info) {
          // Insert a RECAP button just after the original link.
          $('<a/>', {
            'class': 'recap-inline',
            title: 'Available for free from RECAP.',
            href: info.filename
          }).click(function () {
            return handleClick(info.filename, info.timestamp);
          }).append(
            $('<img/>').attr({src: chrome.extension.getURL('assets/images/icon-16.png')})
          ).insertAfter(links[i]);
        }
      })(result[links[i].href]);
    }
  });
}
