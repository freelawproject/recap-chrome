// Content script to run when DOM finishes loading (run_at: "document_end").


var notifier = importInstance(Notifier);
var toolbar_button = importInstance(ToolbarButton);

var url = window.location.href;
var path = window.location.pathname;
var court = PACER.getCourtFromUrl(url);
// Referrer is used here because typically the URL that has the pacer_case_id is
// the one that with the form that generates the docket.
var pacer_case_id = PACER.getCaseNumberFromUrls([document.referrer, url]);
var pacer_doc_id = PACER.getDocumentIdFromUrl(url);
var links = document.body.getElementsByTagName('a');

// Update the toolbar button with knowledge of whether the user is logged in.
toolbar_button.updateCookieStatus(court, document.cookie, null);

// Create a delegate for handling the various states we might be in.
var content_delegate = new ContentDelegate(
  url, path, court, pacer_case_id, pacer_doc_id, links);

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

// Check every link in the document to see if there is a free RECAP document
// available. If there is, put a link with a RECAP icon.
content_delegate.attachRecapLinkToEligibleDocs();
