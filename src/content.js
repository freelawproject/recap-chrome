// Content script to run when DOM finishes loading (run_at: "document_end").

let url = window.location.href;
let court = PACER.getCourtFromUrl(url);

// Create a delegate for handling the various states we might be in.
let path = window.location.pathname;
// Referrer is used here because typically the URL that has the pacer_case_id is
// the one that with the form that generates the docket.
let pacer_case_id = PACER.getCaseNumberFromInputs(url, document) ||
  PACER.getCaseNumberFromUrls([url, document.referrer]);
let pacer_doc_id = PACER.getDocumentIdFromForm(url, document) ||
  PACER.getDocumentIdFromUrl(url);
let links = document.body.getElementsByTagName('a');

// seed the content_delegate with the tabId by waiting for the
// message to return from the background worker before initializing
getTabIdForContentScript().then(msg => {

  // destructure the msg object to get the tabId
  const { tabId } = msg;

  let content_delegate = new ContentDelegate(tabId,
    url, path, court, pacer_case_id, pacer_doc_id, links);

  if (PACER.hasPacerCookie(document.cookie)) {
    // If this is a docket query page, ask RECAP whether it has the docket page.
    content_delegate.handleDocketQueryUrl();

    // If this is a docket page, upload it to RECAP.
    content_delegate.handleDocketDisplayPage();

    // If the page offers the ability to download a zip file, intercept navigation
    // to the post-submit page.
    content_delegate.handleZipFilePageView();

    // If this is a document's menu of attachments (subdocuments), upload it to
    // RECAP.
    content_delegate.handleAttachmentMenuPage();

    // If this page offers a single document, ask RECAP whether it has the document.
    content_delegate.handleSingleDocumentPageCheck();

    // If this page offers a single document, intercept navigation to the document
    // view page.  The "View Document" button calls the goDLS() function, which
    // creates a <form> element and calls submit() on it, so we hook into submit().
    content_delegate.handleSingleDocumentPageView();

    // If this is a Clams Register, we upload it to RECAP
    content_delegate.handleClaimsPageView();

    // Check every link in the document to see if there is a free RECAP document
    // available. If there is, put a link with a RECAP icon.
    content_delegate.attachRecapLinkToEligibleDocs();
  } else {
    console.info(`RECAP: Taking no actions because not logged in: ${url}`);
  }
});
