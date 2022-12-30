// Content script to run when DOM finishes loading (run_at: "document_end").

let url = window.location.href;
let court = PACER.getCourtFromUrl(url);

// Create a delegate for handling the various states we might be in.
let path = window.location.pathname;
// Referrer is used here because typically the URL that has the pacer_case_id is
// the one that with the form that generates the docket.
let pacer_case_id =
  PACER.getCaseNumberFromInputs(url, document) || PACER.getCaseNumberFromUrls([url, document.referrer]);
let pacer_doc_id = PACER.getDocumentIdFromForm(url, document) || PACER.getDocumentIdFromUrl(url);
let links = document.body.getElementsByTagName('a');

// seed the content_delegate with the tabId by using the message
// returned from the background worker
async function addRecapInformation(msg) {
  // destructure the msg object to get the tabId
  const { tabId } = msg;

  if (!PACER.hasPacerCookie(document.cookie)) {
    console.info(`RECAP: Taking no actions because not logged in: ${url}`);

    let redactionConfirmation = document.getElementById('redactionConfirmation');

    let emailInput = document.getElementById('loginForm:loginName');
    let passwordInput = document.getElementById('loginForm:password');

    if (emailInput && passwordInput && redactionConfirmation) {
      removeFilingState(msg);
    }

    if (redactionConfirmation) {
      let redactionObserver = new MutationObserver((mutationRecords) => handleRedactionConfirmation(mutationRecords));
      redactionObserver.observe(redactionConfirmation, {
        attributes: true,
        attributeOldValue: true,
      });
    }

    return;
  }

  if (PACER.isAppellateCourt(court)) {
    let AppDelegate = new AppellateDelegate(tabId, court, url, links);

    AppDelegate.dispatchPageHandler();
  } else {
    let content_delegate = new ContentDelegate(tabId, url, path, court, pacer_case_id, pacer_doc_id, links);

    // Checks links on the page to get and store the pacer_doc_id and pacer_case_id found in document links.
    await content_delegate.findAndStorePacerDocIds();
    
    // If this is a blank iquery or manage my account page, add RECAP Email advertisement banner.
    content_delegate.addRecapEmailAdvertisement();

    // If this is an iquery summary page, upload it to RECAP.
    content_delegate.handleiQuerySummaryPage();

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
  }
}

// Callback function to execute when mutations in the input with
// the id "all_case_id" are observed
function handleCaseIdChange(mutationRecords) {
  let target = mutationRecords[0].target;
  if (target.value != 0) {
    pacer_case_id = target.value;
    url = PACER.formatDocketQueryUrl(url, pacer_case_id);
    getTabIdForContentScript().then((msg) => {
      saveCaseIdinTabStorage(msg, pacer_case_id);
      addRecapInformation(msg);
    });
  }
}

// Callback function to execute when the redaction confirmation
// message appears in the login page
function handleRedactionConfirmation(mutationRecords) {
  getTabIdForContentScript().then((msg) => {
    setFilingState(msg);
  });
}

// Callback function to execute when the RECAP actions button
// is inserted in the docket display page
function handleRecapActionButtonInsertion(mutationRecords) {
  let recapRefreshButton = document.getElementById('refresh-recap-links');
  if (recapRefreshButton) {
    recapRefreshButton.addEventListener('click', () => {
      let links = document.querySelectorAll('.recap-inline');
      links.forEach((link) => {
        link.remove();
      });
      let spinner = document.getElementById('recap-button-spinner');
      if (spinner) {
        spinner.classList.remove('recap-btn-spinner-hidden');
      }
      getTabIdForContentScript().then((msg) => {
        addRecapInformation(msg);
      });
    });
  }
}

// Query relevant inputs in the page.
let caseNumberInput = document.getElementById('case_number_text_area_0');
let allCaseInput = document.getElementById('all_case_ids');

// Query the body content of the first table on the page.
let tableBody = document.querySelector('tbody');

if (allCaseInput) {
  // create a mutation observer to watch for changes being made to
  // the value attribute in the input with the id "all_case_id"
  const observer = new MutationObserver((mutationRecords) => handleCaseIdChange(mutationRecords));
  observer.observe(allCaseInput, {
    attributes: true,
    attributeFilter: ['value'],
  });
}

if (caseNumberInput) {
  // Add listener to the search bar
  caseNumberInput.addEventListener('input', () => {
    PACER.removeBanners();
  });
}

// if the content script found a tbody element on the page, It would create an
// observer to watch for insertions/removal of a child inside that HTML tag.
//
// This operation(insertion/removal) is relevant because the "RECAP actions" button
// is inserted inside a tbody tag some time after the js files from the extension
// are loaded, so it's not possible to query or add a listener to this button right
// from the start.
//
// this mutation will help the extension know when a new element is inserted in the
// tbody tag and the callback function will check if this new element is the "RECAP
// actions" button.
if (tableBody) {
  // create a mutation observer to watch for changes being made to
  // the childlist of the table element
  const observer = new MutationObserver((mutationRecords) => handleRecapActionButtonInsertion(mutationRecords));
  observer.observe(tableBody, {
    subtree: false,
    childList: true,
  });
}

// if the content script didn't find the case Id,
// check the page for the value in the input with the id 'all_case_ids'.
if (!pacer_case_id) {
  let inputValue = !!allCaseInput && allCaseInput.value;
  if (!!inputValue) {
    pacer_case_id = inputValue;
    url = PACER.formatDocketQueryUrl(url, pacer_case_id);
  }
}

// Get the tabId from the background worker to save the pacer_case_id
// in chrome local storage and add recap information to the page.
getTabIdForContentScript().then((msg) => {
  if (pacer_case_id) {
    saveCaseIdinTabStorage(msg, pacer_case_id);
  }
  addRecapInformation(msg);
});
