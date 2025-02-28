// -------------------------------------------------------------------------
// Browser-specific utilities for use in background pages and content scripts.

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
function getClIdFromAbsoluteURL(absoluteURL) {
  // this will match the sequence of digits in the absolute URL
  return absoluteURL.match(/\d+/)[0];
}

// helper functions for chrome local storage

const getItemsFromStorage = (key) =>
  new Promise((resolve, reject) => {
    const stringKey = typeof key === 'number' ? key.toString() : key;
    chrome.storage.local.get(stringKey, (result) => {
      resolve(result[stringKey]);
    });
  });

const saveItemToStorage = (dataObj) =>
  new Promise((resolve, reject) =>
    chrome.storage.local.set(dataObj, () =>
      resolve(
        console.log(
          `RECAP: Item saved in storage at tabId: ${Object.keys(dataObj)[0]}`
        )
      )
    )
  );

const destroyTabStorage = (key) => {
  chrome.storage.local.get(null, (store) => {
    if (store[key]) {
      chrome.storage.local.remove(key.toString(), () =>
        console.log(`Removed item from storage with key ${key}`)
      );
    }
  });
};
// initialize the store with an empty object
const getTabIdForContentScript = () =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage({ message: 'requestTabId' }, (msg) =>
      resolve(msg)
    );
  });

// object takes shape of { [tabId]: { ...data } }
const updateTabStorage = async (object) => {
  const tabId = Object.keys(object)[0];
  const updatedVars = object[tabId];
  const store = await getItemsFromStorage(tabId);
  // keep store immutable
  saveItemToStorage({ [tabId]: { ...store, ...updatedVars } });
};

// Save case_id in the chrome local storage
const saveCaseIdinTabStorage = async (object, case_id) => {
  const { tabId } = object;
  const payload = {
    caseId: case_id,
    docketNumber: '',
  };
  await updateTabStorage({
    [tabId]: payload,
  });
};

// Save a cookie in document.cookie to let the extension know that the user has
// filing rights
const setFilingState = () => {
  document.cookie = 'isFilingAccount=true;path=/;domain=.uscourts.gov';
};

// Reset the value of the cookie related to the filing rights of a user
const removeFilingState = () => {
  document.cookie = 'isFilingAccount=false;path=/;domain=.uscourts.gov';
};

// converts an ISO-8601 date str to 'MM/DD/YYYY' format
function pacerDateFormat(date) {
  return date.replace(/(\d+)-(\d+)-(\d+)/, '$2/$3/$1');
}


const blobToDataURL = (blob) => {
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

// Creates a div element with the recap logo and a message
const makeMessageForBanners = (text) => {
  const innerDiv = document.createElement('div');
  innerDiv.classList.add('d-inline-flex');
  innerDiv.classList.add('banner-message');

  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('assets/images/icon-16.png');

  const p = document.createElement('p');
  p.innerHTML = text;

  innerDiv.appendChild(img);
  innerDiv.appendChild(p);

  return innerDiv;
};

// inject a "follow this case on RECAP" button
const recapAlertButton = (court, pacerCaseId, isActive) => {
  const anchor = document.createElement('a');
  anchor.setAttribute('id', 'recap-alert-button');
  anchor.setAttribute('role', 'button');
  anchor.setAttribute('aria-disabled', isActive ? 'true' : false);
  if (!isActive) {
    anchor.classList.add('disabled');
  }

  const icon = isActive ? 'icon' : 'grey';
  const text = isActive
    ? 'Create an Alert for this Case on RECAP'
    : 'Alerts not yet Supported for this Docket';

  const url = new URL('https://www.courtlistener.com/alert/docket/new/');
  url.searchParams.append('pacer_case_id', pacerCaseId);
  url.searchParams.append('court_id', court);
  anchor.href = url.toString();

  const img = document.createElement('img');
  img.src = chrome.runtime.getURL(`assets/images/${icon}-16.png`);

  let innerDiv = makeMessageForBanners(text);

  anchor.append(innerDiv);

  return anchor;
};

// Creates an anchor element to autofill the Docket Query form
const recapAddLatestFilingButton = (result) => {
  let date = result.date_last_filing;
  let formatted_date = pacerDateFormat(date);

  const anchor = document.createElement('a');
  anchor.classList.add('recap-filing-button');
  anchor.title =
    'Autofill the form to get the latest content not yet in RECAP, omitting ' +
    'parties and member cases.';
  anchor.dataset.dateFrom = formatted_date;
  anchor.href = '#';

  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('assets/images/icon-16.png');

  anchor.appendChild(img);

  anchor.onclick = function (e) {
    let target = e.currentTarget || e.target;

    let dateInput = document.querySelector("[name='date_from']");
    let partyCheckbox = document.getElementById('list_of_parties_and_counsel');
    let filedCheckbox = document.querySelector('input[value="Filed"]');
    let terminatedParties = document.getElementById('terminated_parties');

    dateInput.value = target.dataset.dateFrom;
    partyCheckbox.checked = false;
    terminatedParties.checked = false;
    filedCheckbox.checked = true;

    return false;
  };

  return anchor;
};

// Creates a div element to show a docket is available for free
const recapBanner = (result) => {
  const div = document.createElement('div');
  div.setAttribute('class', 'recap-banner');

  const anchor = document.createElement('a');
  anchor.title = 'Docket is available for free in the RECAP Archive.';
  anchor.target = '_blank';
  anchor.href = `https://www.courtlistener.com${result.absolute_url}`;

  const time = document.createElement('time');
  time.dataset.livestamp = result.date_modified;
  time.setAttribute('title', result.date_modified);
  time.innerHTML = result.date_modified;

  let message =
    'View and Search this docket as of ' +
    `${time.outerHTML} for free from RECAP`;
  let innerDiv = makeMessageForBanners(message);

  const small = document.createElement('small');
  small.innerText = 'Note that archived dockets may be out of date';

  anchor.append(innerDiv);

  div.appendChild(anchor);
  div.appendChild(document.createElement('br'));
  div.appendChild(small);
  return div;
};

// Creates a div element to advertise RECAP email
const recapEmailBanner = (css_class = 'recap-email-banner') => {
  const div = document.createElement('div');
  div.setAttribute('class', css_class);

  const anchor = document.createElement('a');
  anchor.target = '_blank';
  anchor.href = `https://www.courtlistener.com/help/recap/email/`;

  let message =
    'Use @recap.email to automatically contribute all your cases to RECAP.';
  let innerDiv = makeMessageForBanners(message);

  anchor.appendChild(innerDiv);
  div.appendChild(anchor);
  return div;
};

// Creates a div element to show a document is available for free in the
// RECAP archive
const insertAvailableDocBanner = (doc_url, html_element) => {
  let href = `https://storage.courtlistener.com/${doc_url}`;
  // Insert a RECAP download link at the bottom of the form.
  $('<div class="recap-banner"/>')
    .append(
      $('<a/>', {
        title: 'Document is available for free in the RECAP Archive.',
        href: href,
      })
        .append(
          $('<img/>', {
            src: chrome.runtime.getURL('assets/images/icon-16.png'),
          })
        )
        .append(' Get this document for free from the RECAP Archive.')
    )
    .appendTo($(html_element));
};

// Creates a div element to let user know they're trying to buy a combined PDF
const combinedPdfWarning = () => {
  let img = document.createElement('img');
  img.src = chrome.runtime.getURL('assets/images/disabled-38.png');
  img.style.width = 'auto';
  img.style.height = 'auto';
  img.style.maxWidth = '38px';
  img.style.maxHeight = '38px';

  let imgDiv = document.createElement('div');
  imgDiv.style.padding = '12px';
  imgDiv.style.display = 'flex';
  imgDiv.style.alignItems = 'center';
  imgDiv.appendChild(img);

  let text = document.createElement('p');
  text.innerHTML =
    'This document <b>will not be uploaded</b> to the RECAP ' +
    'Archive because the extension has detected that this page may return ' +
    'a combined PDF and consistently splitting these files in a proper ' +
    'manner is not possible for now.';

  let messageDiv = document.createElement('div');
  messageDiv.classList.add('recap-combined-pdf-text');
  messageDiv.appendChild(text);

  let innerDiv = document.createElement('div');
  innerDiv.classList.add('recap-banner');
  innerDiv.style.display = 'flex';
  innerDiv.appendChild(imgDiv);
  innerDiv.appendChild(messageDiv);

  let outerDiv = document.createElement('div');
  outerDiv.style.display = 'flex';
  outerDiv.style.justifyContent = 'center';
  outerDiv.appendChild(innerDiv);

  return outerDiv;
};

async function getDocToCasesFromStorage(tabId){
  const tabStorage = await getItemsFromStorage(tabId);
  return tabStorage && tabStorage.docsToCases;
}

//Given a pacer_doc_id, return the pacer_case_id that it is associated with
async function getPacerCaseIdFromPacerDocId(tabId, pacer_doc_id) {
  const docsToCases = await getDocToCasesFromStorage(tabId);
  if (!docsToCases) return;

  const caseId = docsToCases[pacer_doc_id];
  if (!caseId) return console.warn('No pacer_case_id found in storage');

  const success = `RECAP: Got case number ${caseId} for docId ${pacer_doc_id}`;
  console.info(success);
  return caseId;
}

// Retrieves the attachment number using the pacer_doc_id
async function getAttachmentNumberFromPacerDocId(tabId, pacer_doc_id) {
  const tabStorage = await getItemsFromStorage(tabId);
  const docsToAttachmentNumbers =
    tabStorage && tabStorage.docsToAttachmentNumbers;
  if (!docsToAttachmentNumbers) return;

  const attachmentNumber = docsToAttachmentNumbers[pacer_doc_id];
  if (!attachmentNumber) return;
  return attachmentNumber;
}

// Retrieves the full Pacer document ID from a partial ID.
//
// Fetches the stored documents-to-cases mapping from the current tab's storage
// Filters out the Pacer document IDs using the provided partial ID. Returns
// the full Pacer document ID if a single match is found; otherwise, returns
// `undefined`.
async function getPacerDocIdFromPartialId(tabId, partialId) {
  const docsToCases = await getDocToCasesFromStorage(tabId);
  if (!docsToCases) return;

  let docIds = Object.keys(docsToCases);
  let pacerDocId = docIds.filter((id) => id.includes(partialId));
  if (pacerDocId.length === 0) return;
  return PACER.cleanPacerDocId(pacerDocId[0]);
}

// Retrieves the Pacer document ID using an exclude list.
//
// This function fetches the stored documents-to-cases mapping from the current
// tab's storage. It then filters out the Pacer document IDs using the array of
// the attachment IDs to exclude. If there's only one remaining Pacer document
// ID, it's returned. Otherwise, undefined is returned.
async function getPacerDocIdFromExcludeList(tabId, excludeList){
  const docsToCases = await getDocToCasesFromStorage(tabId);
  if (!docsToCases) return;

  var pacerDocIds = Object.keys(docsToCases);
  excludeList.forEach(
    (attachmentId) =>
      (pacerDocIds = pacerDocIds.filter((key) => !key.includes(attachmentId)))
  );
  if (pacerDocIds.length > 1) return;
  return PACER.cleanPacerDocId(pacerDocIds[0]);
}

//Creates an extra button for filer accounts
function createRecapButtonForFilers(description) {
  let button = document.createElement('input');
  button.type = 'submit';
  button.value = description;
  button.classList.add('recap-bttn-for-filers', 'btn-primary');
  return button;
}

// Creates a spinner element to be used in the recap button.
//
// **Arguments:**
//  - `hidden` (bool): Whether the spinner should be initially hidden.
//
// **Returns:**
//  - The created spinner element.
function createRecapSpinner(hidden = true) {
  const spinner = document.createElement('i');
  spinner.classList.add('fa', 'fa-spinner', 'fa-spin');
  spinner.setAttribute('id', 'recap-button-spinner');
  if (hidden) spinner.classList.add('recap-btn-spinner-hidden');

  return spinner;
}

// checks if a specific document within a combined PDF page is available in
// the Recap archive. The document is identified by its PACER document ID.
// If the document is found, it inserts a banner to inform the user of its
// availability.
async function checkSingleDocInCombinedPDFPage(
  tabId,
  court,
  docId,
  isAppellate = false
) {
  let clCourt = PACER.convertToCourtListenerCourt(court);
  const urlParams = new URLSearchParams(window.location.search);
  if (isAppellate) {
    // Retrieves a partial document ID from the URL parameter named `"dls"`.
    // It's important to note that this value might not be the complete
    // document ID. It could potentially be a shortened version of the full ID.
    let partialDocId = urlParams.get('dls').split(',')[0];
    // If the pacer_doc_id is not already set, attempt to retrieve it using the
    // previously extracted partial document ID. The returned full document ID
    // is then stored in the `this.pacer_doc_id` property for subsequent use.
    if (!docId) {
      docId = await getPacerDocIdFromPartialId(tabId, partialDocId);
    }
  } else {
    // The URL of multi-document pages in district courts often contains a list
    // of documents that are excluded from purchase.
    let excludeList = urlParams.get('exclude_attachments').split(',');
    // If the pacer_doc_id is not already set, attempt to retrieve it from the
    // extracted `excludeList`.
    if (!docId) {
      docId = await getPacerDocIdFromExcludeList(tabId, excludeList);
    }
  }

  // If we don't have this.pacer_doc_id at this point, punt.
  if (!docId) return;

  const recapLinks = await dispatchBackgroundFetch({
    action: 'getAvailabilityForDocuments',
    data: {
      docket_entry__docket__court: clCourt,
      pacer_doc_id__in: docId,
    },
  });
  if (!recapLinks.results.length) return docId;
  console.info(
    'RECAP: Got results from API. Processing results to insert link'
  );
  let result = recapLinks.results.filter(
    (doc) => doc.pacer_doc_id === docId,
    this
  );
  if (!result.length) return docId;

  let targetDiv = isAppellate ? 'body' : '#cmecfMainContent';
  insertAvailableDocBanner(result[0].filepath_local, targetDiv);
  return docId;
}
