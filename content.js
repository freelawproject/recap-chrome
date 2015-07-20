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

var url = window.location.href;
var path = window.location.pathname;
var court = PACER.getCourtFromUrl(url);
var casenum = PACER.getCaseNumberFromUrl(document.referrer);
var docid = PACER.getDocumentIdFromUrl(url);
var links = document.body.getElementsByTagName('a');

// Update the toolbar button with knowledge of whether the user is logged in.
toolbar_button.updateCookieStatus(court, document.cookie, null);

// Create a delegate for handling the various states we might be in.
var content_delegate = new ContentDelegate(
  url, path, court, casenum, docid, links);

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
// Then add mouseover events to links of the 'show_doc' type.
content_delegate.addMouseoverToConvertibleLinks();

// Check every link in the document to see if there is a free RECAP document
// available. If there is, put a link with a RECAP icon.
content_delegate.attachRecapLinkToEligibleDocs();
