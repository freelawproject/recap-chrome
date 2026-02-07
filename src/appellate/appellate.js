let acmsPageObserver = null;

//  Abstraction of scripts related to Appellate PACER to make them modular and
// testable.
let AppellateDelegate = function (tabId, court, url, path, links) {
  this.tabId = tabId;
  this.court = court;
  this.url = url;
  this.path = path;
  this.links = links || [];
  this.queryParameters = APPELLATE.getQueryParameters(this.url);
  this.docId = APPELLATE.getDocIdFromURL(this.queryParameters);
  this.docketNumber = APPELLATE.getDocketNumber(this.queryParameters);
};

// Identify regular Appellate pages using the URL and the query string,
AppellateDelegate.prototype.regularAppellatePageHandler = function () {
  let targetPage =
    this.queryParameters.get('servlet') || APPELLATE.getServletFromInputs();
  switch (targetPage) {
    case 'CaseSummary.jsp':
      this.handleDocketDisplayPage();
      this.attachRecapLinksToEligibleDocs();
      break;
    case 'CaseSelectionTable.jsp':
      this.handleCaseSelectionPage();
      break;
    case 'CaseSearch.jsp':
      this.handleCaseSearchPage();
      break;
    case 'DocketReportFilter.jsp':
      this.handleDocketReportFilter();
      break;
    case 'CaseQuery.jsp':
      this.handleCaseQueryPage();
      break;
    case 'ShowDocMulti':
      this.handleCombinedPdfPageView();
      break;
    default:
      if (APPELLATE.isAttachmentPage()) {
        this.handleAttachmentPage();
        this.attachRecapLinksToEligibleDocs();
      } else if (APPELLATE.isSingleDocumentPage()) {
        this.handleSingleDocumentPageView();
      } else {
        console.info('No identified appellate page found');
      }
      break;
  }
};

AppellateDelegate.prototype.ACMSPageHandler = function () {
  // ACMS pages use HTMX for partial page updates, which means content loads
  // asynchronously and replaces sections of the DOM without reloading the full
  // page. Because of this, we use a MutationObserver to detect when specific
  // ACMS components are injected into the DOM and trigger the appropriate
  // handlers at the right time.
  //
  // The observer watches for additions to the DOM and runs the correct handler
  // whenever a known ACMS page structure appears.
  const pageObserver = async (mutationList, observer) => {
    for (const r of mutationList) {
      // We could restrict this to div#box, but that feels overspecific
      for (const node of r.addedNodes) {
        if (node.tagName !== 'DIV') continue;
        if (node.id === 'indexContent' || node.id === 'fullDocketContent') {
          this.handleAcmsDocket();
        }
        if (node.classList.contains('documents-list-wrapper')) {
          this.handleAcmsAttachmentPage();
        }
        if (node.textContent.toLowerCase().includes('download confirmation')) {
          this.handleAcmsDownloadPage();
        }
      }
    }
  };

  // If ACMS has already rendered the main content container (indexContent),
  // we can immediately initialize the docket handler without waiting for
  // HTMX updates. This handles cases where the page loads fully before
  // the extension runs or when navigating back/forward.
  if (
    document.getElementById('indexContent') ||
    document.getElementById('fullDocketContent')
  ) {
    this.handleAcmsDocket();
  }

  if (acmsPageObserver) return;

  // Always set up the observer to watch for HTMX updates, even if content
  // is already present. HTMX can trigger partial page updates at any time,
  // and we need to respond to those changes in both Chrome (node-by-node
  // loading) and Firefox (full page already loaded).
  const body = document.querySelector('body');
  acmsPageObserver = new MutationObserver(pageObserver.bind(this));
  acmsPageObserver.observe(body, { subtree: true, childList: true });
};

// Identify and handle pages from Appellate courts.
AppellateDelegate.prototype.dispatchPageHandler = function () {
  if (PACER.isACMSWebsite(this.url)) {
    this.ACMSPageHandler();
  } else {
    this.regularAppellatePageHandler();
  }
};

AppellateDelegate.prototype.handleAcmsAttachmentPage = async function () {
  const getDocketEntryId = async () => {
    // Retrieves the docketEntryId associated with the currently
    // displayed ACMS document viewer modal.
    //
    // This works by:
    // 1. Reading the `docsToEntries` mapping stored in tab storage,
    //    which maps document IDs to docket entry IDs.
    // 2. Locating the document viewer modal.
    // 3. Extracting the `data-doc-id` from the first `.entry-link`
    //    element in the modal.
    // 4. Returning the corresponding docketEntryId.
    const tabStorage = await getItemsFromStorage(this.tabId);
    const docsToEntries = tabStorage && tabStorage.docsToEntries;

    const modal = document.getElementById('document-viewer-modal');
    const links = modal.querySelectorAll('.entry-link');

    return docsToEntries[links[0].dataset.docId];
  };

  const processAttachmentPage = async (entryId) => {
    // Processes the ACMS attachment page by building a RECAP upload
    // payload and sending it to the background for upload.
    //
    // Steps performed:
    // 1. Reads the ACMS document view model from session storage.
    // 2. Extracts the relevant case details and docket entry data.
    // 3. Separates docket entry metadata from its documents to keep
    //    the payload structure consistent with existing RECAP uploads.
    // 4. Sends the attachment page data to the background for upload.
    // 5. Displays a success or failure notification to the user.
    let caseData = JSON.parse(sessionStorage.recapDocViewModel);
    const { caseDetails, docketEntries } = caseData;
    const docketDetails = caseDetails[0];
    this.pacer_case_id = docketDetails.caseId;

    const options = await getItemsFromStorage('options');
    if (!options['recap_enabled']) {
      return console.info(
        'RECAP: Not uploading docket json. RECAP is disabled.'
      );
    }

    const docketEntryData = docketEntries.find(
      (entry) => entry.docketEntryId == entryId
    );
    // Remove documents from the docketEntry object and send them
    // separately to avoid nesting document data twice.
    const { docketEntryDocuments, ...docketEntry } = docketEntryData;

    let requestBody = {
      caseDetails: docketDetails,
      docketEntry,
      docketEntryDocuments,
    };

    const upload = await dispatchBackgroundFetch({
      action: 'upload',
      data: {
        court: PACER.convertToCourtListenerCourt(this.court),
        pacer_case_id: this.pacer_case_id,
        upload_type: 'ACMS_ATTACHMENT_PAGE',
        html: JSON.stringify(requestBody),
      },
    });
    if (upload.error) {
      await dispatchBackgroundNotifier({
        action: 'showUpload',
        title: 'Page Upload Failed',
        message: 'Error: The Attachment page was not uploaded to the public' +
          'RECAP Archive',
      });
    }else{
      history.replaceState({ uploaded: true }, '');
      await dispatchBackgroundNotifier({
        action: 'showUpload',
        title: 'Page Successfully Uploaded',
        message: 'Attachment page uploaded to the public RECAP Archive.',
      });
    }

  };

  const attachLinkToDocs = async (entryId) => {
    // This function attaches links to available RECAP documents for each entry
    // on the current page. It performs the following steps:
    //
    // 1. Retrieves docket entry and document data from session storage.
    // 2. Collects all document entry links within the document viewer modal.
    // 3. Queries the RECAP backend to check which documents are available.
    // 4. Matches available documents using the `data-doc-id` attribute.
    // 5. Inserts a RECAP icon linking to the free document next to
    //    each corresponding entry link.
    let caseData = JSON.parse(sessionStorage.recapDocViewModel);
    const { docketEntries } = caseData;
    const docketEntryData = docketEntries.find(
      (entry) => entry.docketEntryId == entryId
    );

    // Scope all DOM queries to the document viewer modal to avoid
    // accidentally matching links elsewhere on the page.
    const modal = document.getElementById('document-viewer-modal');

    // Get all the entry links on the page. We use the "entry-link"
    // class as a selector because all rows on the page
    // consistently use this class.
    this.links = modal.querySelectorAll('.entry-link');
    if (!this.links.length) return;

    let docIds = [docketEntryData.docketEntryId];
    let clCourt = PACER.convertToCourtListenerCourt(this.court);

    // Ask the server which documents for this docket entry
    // are available from the RECAP Archive.
    const recapLinks = await dispatchBackgroundFetch({
      action: 'getAvailabilityForDocuments',
      data: {
        docket_entry__docket__court: clCourt,
        pacer_doc_id__in: docIds.join(','),
      },
    });
    for (result of recapLinks.results) {
      let doc_guid = result.acms_document_guid;
      // Query the docket entry link using the
      // `data-doc-id` attribute embedded by ACMS.
      let anchor = document.querySelector(
        `[data-doc-id="${doc_guid}"]`
      );

      // Create the RECAP icon and link to the document.
      let href = `https://storage.courtlistener.com/${result.filepath_local}`;
      let recap_link = $('<a/>', {
        title: 'Available for free from the RECAP Archive.',
        href: href,
      });
      recap_link.append(
        $('<img/>').attr({
          src: chrome.runtime.getURL('assets/images/icon-16.png'),
        })
      );
      let recap_div = $('<div>', {
        class: 'recap-inline-appellate',
      });
      recap_div.append(recap_link);
      // Insert the RECAP icon immediately after the
      // corresponding ACMS document link.
      recap_div.insertAfter(anchor);
    }
  };

  const wrapperMutationObserver = async (mutationList, observer) => {
    // Observes the ACMS attachment page for DOM changes and detects
    // when the attachments section becomes available.
    //
    // The observer looks for an H4 element containing the text
    // "documents are attached to this filing". Once detected:
    // 1. The active docketEntryId is resolved from the document modal.
    // 2. The attachment page is processed and uploaded to RECAP.
    // 3. RECAP availability icons are attached to document links.
    // 4. The observer disconnects to prevent duplicate work.
    for (const r of mutationList) {
      for (const n of r.addedNodes) {
        // Look for the H4 either on the node itself or inside it
        let h4 = n.tagName === 'H4' ? n : n.querySelector('h4');
        if (!h4) continue;

        let isAttachmentsTitle = n.textContent
          .toLowerCase()
          .includes('documents are attached to this filing');
        if (!isAttachmentsTitle) continue;

        let entryId = await getDocketEntryId();
        processAttachmentPage(entryId);
        attachLinkToDocs(entryId);

        // Disconnect after the first successful match to avoid
        // repeated uploads or duplicate icon insertion.
        observer.disconnect();
      }
    }
  };

  const wrapper = document.querySelector('.documents-list-wrapper');
  const observer = new MutationObserver(wrapperMutationObserver);
  observer.observe(wrapper, { subtree: true, childList: true });
};

AppellateDelegate.prototype.handleAcmsDocket = async function () {
  const getACMSCaseIdFromSession = async () => {
    // Retrieves the pacer_case_id from the ACMS metadata stored in
    // sessionStorage
    let caseData = JSON.parse(sessionStorage.recapDocViewModel);
    const { caseDetails } = caseData;
    const docketDetails = caseDetails[0];
    return docketDetails.caseId;
  };

  const processDocket = async () => {
    // Uploads the ACMS docket JSON metadata to the RECAP archive.
    //
    // Steps performed:
    //  1. Reads `recapDocViewModel` from sessionStorage, which contains both
    //     caseDetails and docketInfo as provided by ACMS.
    //  2. Extracts only the fields required for RECAP.
    //  3. Skips upload if the page was already uploaded in this session
    //  4. Respects user preferences by checking if RECAP uploads are disabled.
    //  5. Sends the structured docket metadata to the background worker for
    //     upload.
    //  6. Displays a success notification if the upload completes without error
    const caseData = JSON.parse(sessionStorage.recapDocViewModel);

    // Only keep what we need
    const { caseDetails, docketInfo } = caseData;
    const docketDetails = caseDetails[0];

    if (history.state && history.state.uploaded) return;

    const options = await getItemsFromStorage('options');
    if (!options['recap_enabled']) {
      console.info('RECAP: Not uploading docket json. RECAP is disabled.');
      return;
    }

    const upload = await dispatchBackgroundFetch({
      action: 'upload',
      data: {
        court: PACER.convertToCourtListenerCourt(this.court),
        pacer_case_id: this.pacer_case_id,
        upload_type: 'ACMS_DOCKET_JSON',
        html: JSON.stringify({ caseDetails: docketDetails, docketInfo }),
      },
    });
    if (upload.error) return;
    history.replaceState({ uploaded: true }, '');
    await dispatchBackgroundNotifier({
      action: 'showUpload',
      title: 'Page Successfully Uploaded',
      message: 'Docket uploaded to the public RECAP Archive.',
    });
  };

  const insertRecapButton = async () => {
    // Inserts the "RECAP actions" button at the top of the docket view.
    // This function performs the following steps:
    //  1. Locates the primary case-information table rendered by ACMS.
    //  2. Checks whether a RECAP action button is already present to
    //     avoid duplicates.
    //  3. If not present, creates a new RECAP actions button using
    //     the `recapActionsButton` function.
    //  4. Queries RECAP for docket availability information.
    //  5. If a single docket record exists:
    //     - Adds an alert button to the buttons dropdown menu.
    //     - Adds a search-in-RECAP link using the CL docket ID.
    let caseInformationTable = document.querySelector('table.case-information');
    // Get a reference to the parent node
    const parentDiv = caseInformationTable.parentNode;
    const existingActionButton = document.getElementById('recap-action-button');
    if (!existingActionButton) {
      let button = recapActionsButton(this.court, this.pacer_case_id, false);
      parentDiv.insertBefore(button, caseInformationTable);
    }
    let docketData = await dispatchBackgroundFetch({
      action: 'getAvailabilityForDocket',
      data: {
        court: PACER.convertToCourtListenerCourt(this.court),
        pacer_case_id: this.pacer_case_id,
      },
    });
    let docketDataCount = docketData.results.length;
    if (docketDataCount == 1){
      addAlertButtonInRecapAction(this.court, this.pacer_case_id);
      let cl_id = getClIdFromAbsoluteURL(docketData.results[0].absolute_url);
      addSearchDocketInRecapAction(cl_id);
    } else{
      PACER.handleDocketAvailabilityMessages(docketDataCount);
    }
  };

  const attachLinkToDocs = async () => {
    // Adds RECAP availability indicators to each docket entry link displayed
    // in the ACMS docket view. It perform the following steps:
    //
    // 1. Data Retrieval:
    //    - Reads the full `recapDocViewModel` from sessionStorage.
    //    - Extract the array of `docketEntries`, each containing documents.
    //    - Query all `.entry-link` anchor tags rendered by ACMS.
    //
    // 2. Docket Entry Mapping:
    //    - For each link, read its `data-docket-entry-id`.
    //    - Look up the matching docketEntry in the `docketEntries` array.
    //    - Collect all docketEntryIds to be checked for RECAP availability.
    //    - Build a `docsToEntries` map that associates each ACMS document ID
    //      (`docketDocumentDetailsId`) with its parent docketEntryId.
    //      This mapping is later used by attachment pages and related workflows
    //
    // 3. RECAP Availability Check:
    //    - Query RECAP via the background worker, requesting availability for
    //      all collected docketEntryIds.
    //    - The court information is also included in the request.
    //
    // 4. Enriching Links with RECAP Information:
    //    For each available document:
    //       - Finds the matching anchor via its data attribute.
    //       - Creates a RECAP link pointing to the stored PDF.
    //       - Wraps the icon and link in a `.recap-inline-appellate` div.
    //       - Appends the div next to the docket entry’s link.

    // Get the docket info from the sessionStorage obj
    const recapDocViewModel = JSON.parse(sessionStorage.recapDocViewModel);
    const docketEntries = recapDocViewModel.docketEntries;

    // Get all the entry links on the page. We use the "entry-link"
    // class as a selector because we observed that all non-restricted
    // entries consistently use this class.
    this.links = document.body.querySelectorAll('.entry-link');
    if (!this.links.length) return;

    // Go through the array of links and collect the doc IDs of
    // the entries that are not restricted.
    let docIds = [];
    let docsToEntries = {};
    for (link of this.links) {
      const docketEntryId = link.dataset.docketEntryId;
      const docketEntryData = docketEntries.find(
        (entry) => entry.docketEntryId == docketEntryId
      );

      // add the id to the array of doc ids
      docIds.push(docketEntryId);
      for (const doc of docketEntryData.docketEntryDocuments) {
        docsToEntries[doc.docketDocumentDetailsId] = docketEntryId;
      }
    }
    let clCourt = PACER.convertToCourtListenerCourt(this.court);
    // submit fetch request through background worker
    const recapLinks = await dispatchBackgroundFetch({
      action: 'getAvailabilityForDocuments',
      data: {
        docket_entry__docket__court: clCourt,
        pacer_doc_id__in: docIds.join(','),
      },
    });

    for (result of recapLinks.results) {
      let doc_id = result.pacer_doc_id;
      // Query the docket entry link using the data attribute
      // attached previously
      let anchor = document.querySelector(`[data-docket-entry-id="${doc_id}"]`);
      // Create the RECAP icon
      let href = `https://storage.courtlistener.com/${result.filepath_local}`;
      let recap_link = $('<a/>', {
        title: 'Available for free from the RECAP Archive.',
        href: href,
      });
      recap_link.append(
        $('<img/>').attr({
          src: chrome.runtime.getURL('assets/images/icon-16.png'),
        })
      );
      let recap_div = $('<div>', {
        class: 'recap-inline-appellate',
      });
      recap_div.append(recap_link);

      // Target the table row (<tr>) corresponding to this docket entry
      let parent_tr = anchor.closest(`tr[data-docket-entry-id="${doc_id}"]`);

      // Within that row, locate the span that contains the document links
      const parent_span = parent_tr.querySelector("span.document-controls");

      // Append the generated RECAP element to the controls area
      parent_span.appendChild(recap_div[0]);

    }
    let spinner = document.getElementById('recap-button-spinner');
    if (spinner) spinner.classList.add('recap-btn-spinner-hidden');
    await updateTabStorage({
      [this.tabId]: {
        docsToEntries: docsToEntries,
      },
    });
  };

  await APPELLATE.storeMetaDataInSession();
  this.pacer_case_id = await getACMSCaseIdFromSession();
  processDocket();
  await insertRecapButton();
  await attachLinkToDocs();
};

AppellateDelegate.prototype.handleAcmsDownloadPage = async function () {

  const isDownloadConfirmationModal = (modal) => {
    // Checks whether the modal contains a transaction receipt and an
    // "Accept Charges and Retrieve" button, indicating it's a download
    // confirmation page we should handle.
    const text = modal.textContent.toLowerCase();
    return (
      text.includes('transaction receipt') &&
      text.includes('accept charges and retrieve')
    );
  };

  const resolveDocumentData = () => {
    // Resolves the specific docket entry and document data associated with
    // the currently displayed download confirmation modal. It performs the
    // following steps:
    // 1. Reads the full `recapDocViewModel` from sessionStorage, which contains
    //    docketEntries.
    // 2. Reads the `recapDownloadDocumentData` from sessionStorage, which
    //    should have been set when the user clicked the document link to
    //    trigger the download modal.
    // 3. Finds the specific docket entry in `docketEntries` that matches the
    //    `docketEntryId` from the download data.
    // 4. If no matching docket entry or documents are found, returns nulls.
    // 5. If multiple documents are associated with the docket entry, matches
    //    on the specific document using `docketDocumentDetailsId`.
    // 6. Returns an object containing both the matched `docketEntryData` and
    //    `documentData` for use in subsequent processing.
    const { docketEntries } = JSON.parse(sessionStorage.recapDocViewModel);
    const downloadData = JSON.parse(
      sessionStorage.getItem('recapDownloadDocumentData')
    );

    const docketEntryData = docketEntries.find(
      (entry) => entry.docketEntryId == downloadData.docketEntryId
    );

    if (!docketEntryData.docketEntryDocuments.length) {
      return { docketEntryData: null, documentData: null };
    }

    // For entries with multiple attachments, match on the specific document
    // that was clicked. For single-document entries, use the only document.
    let documentData;
    if (docketEntryData.docketEntryDocuments.length > 1) {
      documentData = docketEntryData.docketEntryDocuments.find(
        (doc) =>
          doc.docketDocumentDetailsId ==
          downloadData.docketEntryDocuments[0].docketDocumentDetailsId
      );
    } else {
      documentData = docketEntryData.docketEntryDocuments[0];
    }

    return { docketEntryData, documentData };
  };

  insertRecapBannerIfAvailable = async (docketEntryData, documentData) => {
    // Queries the RECAP archive for the document and inserts a download
    // banner if a copy is available.
    const clCourt = PACER.convertToCourtListenerCourt(this.court);

    const recapLinks = await dispatchBackgroundFetch({
      action: 'getAvailabilityForDocuments',
      data: {
        docket_entry__docket__court: clCourt,
        pacer_doc_id__in: docketEntryData.docketEntryId,
      },
    });

    if (!recapLinks) {
      console.error('RECAP: Failed getting availability for dockets.');
      return;
    }

    console.info(
      'RECAP: Got results from API. Processing results to insert banner'
    );

    // For entries with multiple documents, match on the specific ACMS
    // document GUID. Otherwise use the single result.
    let result;
    if (recapLinks.results.length > 1) {
      result = recapLinks.results.find(
        (obj) => obj.acms_document_guid == documentData.docketDocumentDetailsId
      );
    } else {
      result = recapLinks.results[0];
    }
    if (!result) return;

    // Create a centered wrapper div to hold the RECAP banner
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'center';

    const target = document.querySelector(
      '.modal-scrollable-content div.text-center'
    );
    if (!target) return;
    target.appendChild(wrapper);

    // Insert the banner inside the centered wrapper
    insertAvailableDocBanner(result.filepath_local, wrapper);
  };;

  async function startUploadProcess() {
    // This function initiates the upload process for a PDF document
    // from the ACMS download confirmation modal. It performs the
    // following steps:
    //
    // 1. Retrieves configuration and tokens:
    //    - Parses the recapDocViewModel from sessionStorage to extract
    //      the API URL, case number, auth token, and case summary.
    //
    // 2. Prepares data for upload:
    //    - Parses download data from sessionStorage and creates a
    //      request body for the PDF merge API.
    //
    // 3. Builds document summary:
    //    - Creates a documentSummary object containing the docket
    //      number, document number, and attachment number (if the
    //      docket entry has multiple documents).
    //
    // 4. Displays a loading message:
    //    - Clears the modal body and inserts a loading indicator
    //      using APPELLATE.createsLoadingMessage.
    //
    // 5. Stores case ID and document GUID for later use:
    //    - Saves the pacer_case_id from the case summary.
    //    - Saves the ACMS document GUID from the document data.
    //
    // 6. Fetches and downloads the PDF:
    //    - Captures the current HTML for later restoration.
    //    - Calls APPELLATE.fetchAcmsDocumentUrl to get the download
    //      URL from the merge API.
    //    - Fetches the PDF as a blob from that URL.
    //    - Passes the blob to handleDocFormResponse for RECAP upload
    //      and display.
    let {
      baseApiUrl,
      caseNumber,
      docketEntries,
      authTokenResult,
      caseSummaryHeadingViewModel,
    } = JSON.parse(sessionStorage.recapDocViewModel);

    let downloadData = JSON.parse(
      sessionStorage.getItem('recapDownloadDocumentData')
    );
    let docketEntryData = docketEntries.find(
      (entry) => entry.docketEntryId == downloadData.docketEntryId
    );

    if (!docketEntryData.docketEntryDocuments.length) return;

    const pdfFileRequestBody =
      APPELLATE.createAcmsDocumentRequestBody(downloadData);

    let docData = null;
    if (docketEntryData.docketEntryDocuments.length > 1) {
      docData = docketEntryData.docketEntryDocuments.find(
        (doc) =>
          doc.docketDocumentDetailsId ==
          downloadData.docketEntryDocuments[0].docketDocumentDetailsId
      );
    } else {
      docData = docketEntryData.docketEntryDocuments[0];
    }

    let documentSummary = {
      docket_number: caseNumber,
      doc_number: docketEntryData.entryNumber,
      att_number:
        docketEntryData.documentCount > 1 ? docData.documentNumber : null,
    };

    // Remove element from the page to show loading message
    let mainDiv = modal.querySelector('.modal-body');
    mainDiv.innerHTML = '';
    loadingTextMessage = APPELLATE.createsLoadingMessage(caseNumber);
    mainDiv.append(loadingTextMessage);

    // Get the pacer_case_id and document GUID from the sessionStorage object
    this.pacer_case_id = caseSummaryHeadingViewModel.caseId;
    this.acmsDocumentGuid = docData.docketDocumentDetailsId;

    let previousPageHtml = document.documentElement.innerHTML;
    let pdf_url = await APPELLATE.fetchAcmsDocumentUrl({
      apiUrl: baseApiUrl,
      token: authTokenResult.token,
      mergePdfFilesRequest: pdfFileRequestBody,
    });
    const resp = await window.fetch(pdf_url, { method: 'GET' });
    let requestHandler = handleDocFormResponse.bind(this);
    requestHandler(
      resp.headers.get('Content-Type'),
      await resp.blob(),
      null,
      previousPageHtml,
      documentSummary
    );
  }

  const replaceAcceptChargesButton = (modal, docketEntryData, documentData) => {
    // Removes the original "Accept Charges and Retrieve" button and replaces
    // it with a RECAP button that intercepts the download flow.
    //
    // The original button's event handler fetches a one-time-use PDF URL and
    // navigates to it directly. We need to replace it so we can fetch the PDF
    // as a blob, upload it to the RECAP archive, and then display it.
    const acceptChargesButton = modal.querySelector(
      '.modal-fixed-footer button'
    );
    if (!acceptChargesButton) return;

    const parentElement = acceptChargesButton.parentNode;
    acceptChargesButton.remove();

    const newButton = document.createElement('input');
    newButton.type = 'submit';
    newButton.value = 'Accept Charges and RECAP Document';
    newButton.classList.add('btn', 'btn-light', 'btn-outline-dark');
    parentElement.appendChild(newButton);

    newButton.addEventListener(
      'click',
      startUploadProcess.bind(this, modal, docketEntryData, documentData)
    );
  };

  await APPELLATE.storeDocumentDataFromDownloadModal();
  const modal = document.getElementById('document-viewer-modal');

  // Only proceed if this is a billable download confirmation page
  // with the "Accept Charges" button present.
  if (!isDownloadConfirmationModal(modal)) return;

  // We only handle single-document downloads. For combined/multi-document
  // downloads, show a warning banner and exit.
  const transactionReceipts = modal.querySelectorAll('.transaction-receipt');
  if (transactionReceipts.length !== 1) {
    const modalTitle = modal.querySelector('div.text-center');
    modalTitle.appendChild(combinedPdfWarning());
    return;
  }

  // Resolve the specific docket entry and document that triggered the modal,
  // using the docketEntryId stored in sessionStorage by the injected script.
  const { docketEntryData, documentData } = resolveDocumentData();
  if (!docketEntryData || !documentData) return;

  this.docId = docketEntryData.docketEntryId;

  // Replace the default "Accept Charges" button with our own that intercepts
  // the download. The original button's handler fetches a one-time-use PDF URL
  // and navigates to it. We need to intercept before that happens so we can
  // download the PDF as a blob for RECAP upload.
  replaceAcceptChargesButton(modal, docketEntryData, documentData);

  // Check the RECAP archive for an existing copy of this document
  // and display a banner if one is available.
  await insertRecapBannerIfAvailable(docketEntryData, documentData);
};

AppellateDelegate.prototype.handleCaseSearchPage = () => {
  if (!PACER.hasFilingCookie(document.cookie)) return;

  form = document.querySelector('form');
  if (!document.querySelector('.recap-email-banner-full')) {
    form.appendChild(recapEmailBanner('recap-email-banner-full'));
  }
};

AppellateDelegate.prototype.handleDocketReportFilter = async function () {
  if (!this.docketNumber) return;
  let docketNumberCore = PACER.makeDocketNumberCore(this.docketNumber);
  this.pacer_case_id = await APPELLATE.getCaseId(
    this.tabId,
    this.queryParameters,
    this.docId,
    this.docketNumber
  );

  let docketData = await dispatchBackgroundFetch({
    action: 'getAvailabilityForDocket',
    data: {
      court: PACER.convertToCourtListenerCourt(this.court),
      docket_number_core: docketNumberCore,
    },
  });
  let docketDataCount = docketData.results.length;
  if (docketDataCount === 1) {
    let form = document.getElementsByTagName('form')[0];
    let banner = recapBanner(docketData.results[0]);
    form.after(banner);

    if (!this.pacer_case_id) return;
    let recapAlert = document.createElement('div');
    recapAlert.classList.add('recap-banner');
    recapAlert.appendChild(
      recapAlertButton(this.court, this.pacer_case_id, true)
    );
    form.after(recapAlert);
  } else {
    PACER.handleDocketAvailabilityMessages(docketDataCount);
  }
};

AppellateDelegate.prototype.handleCaseSelectionPage = async function () {
  if (document.querySelectorAll('input:not([type=hidden])').length) {
    // When the users go back to the Case Selection Page from the Docket Report
    // using the back button Appellate PACER loads the Case Search Page instead
    // but in the HTML body has the servlet hidden input and shows
    // 'CaseSelectionTable.jsp' as its value.
    //
    // This check avoids sending pages like the one previously described to the
    // API.
    if (!PACER.hasFilingCookie(document.cookie)) return;

    form = document.querySelector('form');
    if (!document.querySelector('.recap-email-banner-full')) {
      form.appendChild(recapEmailBanner('recap-email-banner-full'));
    }

    return;
  }

  if (APPELLATE.caseSelectionPageHasOneRow()) {
    // Retrieve pacer_case_id from the Case Query link
    this.pacer_case_id = APPELLATE.getCaseIdFromCaseSelection();

    let dataTable = APPELLATE.getTableWithDataFromCaseSelection();
    let anchors = dataTable.querySelectorAll('a');

    this.docketNumber = anchors[0].innerHTML;

    await updateTabStorage({
      [this.tabId]: {
        caseId: this.pacer_case_id,
        docketNumber: this.docketNumber,
      },
    });

    let appellateData = await dispatchBackgroundFetch({
      action: 'getAvailabilityForDocket',
      data: {
        court: PACER.convertToCourtListenerCourt(this.court),
        pacer_case_id: this.pacer_case_id,
      },
    });
    let appellateDataCount = appellateData.results.length;
    if (appellateDataCount == 1) {
      PACER.removeBanners();

      const footer = document.querySelector('div.noprint:last-of-type');
      const div = document.createElement('div');
      div.classList.add('recap-banner');
      div.appendChild(recapAlertButton(this.court, this.pacer_case_id, true));
      footer.before(div);

      const rIcon = APPELLATE.makeRButtonForCases(
        appellateData.results[0].absolute_url
      );
      const appellateLink = anchors[0];
      rIcon.insertAfter(appellateLink);
    } else {
      PACER.handleDocketAvailabilityMessages(appellateDataCount);
    }

    if (anchors.length == 3) {
      let districtLink = anchors[anchors.length - 1];
      let districtLinkData = APPELLATE.getDatafromDistrictLinkUrl(
        districtLink.href
      );
      let districtData = await dispatchBackgroundFetch({
        action: 'getAvailabilityForDocket',
        data: {
          court: PACER.convertToCourtListenerCourt(districtLinkData.court),
          docket_number_core: districtLinkData.docket_number_core,
        },
      });
      let districtDataCount = districtData.results.length;
      if (districtDataCount == 1) {
        const rIcon = APPELLATE.makeRButtonForCases(
          districtData.results[0].absolute_url
        );
        rIcon.insertAfter(districtLink);
      } else {
        PACER.handleDocketAvailabilityMessages(districtDataCount);
      }
    }
  } else {
    // Add the pacer_case_id to each docket link to use it in the docket report
    APPELLATE.addCaseIdToDocketSummaryLink();
  }

  const options = await getItemsFromStorage('options');

  if (!options['recap_enabled']) {
    console.info(
      'RECAP: Not uploading case selection page. RECAP is disabled.'
    );
    return;
  }

  const upload = await dispatchBackgroundFetch({
    action: 'upload',
    data: {
      court: PACER.convertToCourtListenerCourt(this.court),
      pacer_case_id: this.pacer_case_id,
      upload_type: 'APPELLATE_CASE_QUERY_RESULT_PAGE',
      html: document.documentElement.innerHTML,
    },
  });
  if (upload.error) return;

  history.replaceState({ uploaded: true }, '');
  await dispatchBackgroundNotifier({
    action: 'showUpload',
    title: 'Page Successfully Uploaded',
    message: 'Case selection page uploaded to the public RECAP Archive.',
  });
};

// Upload the case query page to RECAP
AppellateDelegate.prototype.handleCaseQueryPage = async function () {
  this.pacer_case_id = await APPELLATE.getCaseId(
    this.tabId,
    this.queryParameters,
    this.docId
  );

  if (!this.pacer_case_id) {
    return;
  }

  await updateTabStorage({
    [this.tabId]: {
      caseId: this.pacer_case_id,
      docketNumber: this.docketNumber,
    },
  });

  const options = await getItemsFromStorage('options');
  if (!options['recap_enabled']) return;

  const upload = await dispatchBackgroundFetch({
    action: 'upload',
    data: {
      court: PACER.convertToCourtListenerCourt(this.court),
      pacer_case_id: this.pacer_case_id,
      upload_type: 'APPELLATE_CASE_QUERY_PAGE',
      html: document.documentElement.innerHTML,
    }
  });
  if (upload.error) return;

  history.replaceState({ uploaded: true }, '');
  await dispatchBackgroundNotifier({
    action: 'showUpload',
    title: 'Page Successfully Uploaded',
    message: 'Case query page uploaded to the public RECAP Archive.',
  });
};

// check every link in the document to see if RECAP has it
AppellateDelegate.prototype.attachRecapLinksToEligibleDocs = async function () {
  // When you click a document link, it runs JS that submits this form.
  // Here, we override the target attribute of the form. If you don't do
  // this, the form opens a new tab (target="_blank" by default), and
  // we would be unable to link that tab back to the metadata we
  // captured here. Thus, by overriding this form, we are able to
  // maintain the context we need to upload docs to the archive.

  let form = document.getElementsByName('doDocPostURLForm');
  if (form.length) {
    form[0].setAttribute('target', '_self');
  }

  // filter the links for the documents available on the page
  let { links, docsToCases, docsToAttachmentNumbers } =
    APPELLATE.findDocLinksFromAnchors(
      this.links,
      this.tabId,
      this.queryParameters,
      this.docketNumber
    );

  this.pacer_case_id = this.pacer_case_id
    ? this.pacer_case_id
    : await APPELLATE.getCaseId(
        this.tabId,
        this.queryParameters,
        this.docId,
        this.docketNumber
      );

  if (this.pacer_case_id && this.docId) {
    docsToCases[this.docId] = this.pacer_case_id;
  }

  updateTabStorage({
    [this.tabId]: {
      caseId: this.pacer_case_id,
      docketNumber: this.docketNumber,
      docsToCases: docsToCases,
      docsToAttachmentNumbers: docsToAttachmentNumbers,
    },
  });

  let linkCount = links.length;
  console.info(
    `RECAP: Attaching links to all eligible documents (${linkCount} found)`
  );
  if (linkCount === 0) return;

  let clCourt = PACER.convertToCourtListenerCourt(this.court);
  // submit fetch request through background worker
  const recapLinks = await dispatchBackgroundFetch({
    action: 'getAvailabilityForDocuments',
    data: {
      docket_entry__docket__court: clCourt,
      pacer_doc_id__in: links.join(','),
    },
  });

  // return if there are no results
  if (!recapLinks)
    return console.error('RECAP: Failed getting availability for dockets.');

  console.info(
    'RECAP: Got results from API. Processing results to attach links and ' +
      'icons where appropriate.'
  );
  for (let i = 0; i < this.links.length; i++) {
    let pacer_doc_id = this.links[i].dataset.pacerDocId;
    if (!pacer_doc_id) continue;

    let result = recapLinks.results.filter(function (obj) {
      return obj.pacer_doc_id === pacer_doc_id;
    })[0];
    if (!result) continue;

    let href = `https://storage.courtlistener.com/${result.filepath_local}`;
    let recap_link = $('<a/>', {
      title: 'Available for free from the RECAP Archive.',
      href: href,
    });
    recap_link.append(
      $('<img/>').attr({
        src: chrome.runtime.getURL('assets/images/icon-16.png'),
      })
    );
    let recap_div = $('<div>', {
      class: 'recap-inline-appellate',
    });
    recap_div.append(recap_link);
    recap_div.insertAfter(this.links[i]);
  }
  let spinner = document.getElementById('recap-button-spinner');
  if (spinner)spinner.classList.add('recap-btn-spinner-hidden');
};

AppellateDelegate.prototype.handleDocketDisplayPage = async function () {
  this.pacer_case_id = await APPELLATE.getCaseId(
    this.tabId,
    this.queryParameters,
    this.docId,
    this.docketNumber
  );

  if (!this.pacer_case_id) return;

  // Query the first table with case data and insert the RECAP actions button
  let table = document.querySelectorAll('table')[3];
  const existingActionButton = document.getElementById('recap-action-button');
  if (!existingActionButton) {
    let button = recapActionsButton(this.court, this.pacer_case_id, false);
    table.after(button);
  }

  let docketData = await dispatchBackgroundFetch({
    action: 'getAvailabilityForDocket',
    data: {
      court: PACER.convertToCourtListenerCourt(this.court),
      pacer_case_id: this.pacer_case_id,
    },
  });
  let docketDataCount = docketData.results.length;
  if (docketDataCount === 1) {
    addAlertButtonInRecapAction(this.court, this.pacer_case_id);
    let cl_id = getClIdFromAbsoluteURL(docketData.results[0].absolute_url);
    addSearchDocketInRecapAction(cl_id);
  } else {
    PACER.handleDocketAvailabilityMessages(docketDataCount);
  }

  // if you've already uploaded the page, return
  if (history.state && history.state.uploaded) return;

  const options = await getItemsFromStorage('options');

  if (!options['recap_enabled']) {
    console.info('RECAP: Not uploading docket. RECAP is disabled.');
    return;
  }

  const upload = await dispatchBackgroundFetch({
    action: 'upload',
    data: {
      court: PACER.convertToCourtListenerCourt(this.court),
      pacer_case_id: this.pacer_case_id,
      upload_type: 'APPELLATE_DOCKET',
      html: document.documentElement.innerHTML,
    },
  });
  if (upload.error) return;

  addAlertButtonInRecapAction(this.court, this.pacer_case_id);
  await dispatchBackgroundNotifier({
    action: 'showUpload',
    title: 'Page Successfully Uploaded',
    message: 'Docket page uploaded to the public RECAP Archive',
  });
  history.replaceState({ uploaded: true }, '');
};

AppellateDelegate.prototype.handleAttachmentPage = async function () {
  this.pacer_case_id = await APPELLATE.getCaseId(
    this.tabId,
    this.queryParameters,
    this.docId
  );

  if (!this.pacer_case_id) return;

  if (history.state && history.state.uploaded) return;

  const options = await getItemsFromStorage('options');
  if (!options['recap_enabled']) {
    console.info('RECAP: Not uploading attachment page. RECAP is disabled.');
    return;
  }

  const upload = await dispatchBackgroundFetch({
    action: 'upload',
    data: {
      court: PACER.convertToCourtListenerCourt(this.court),
      pacer_case_id: this.pacer_case_id,
      upload_type: 'APPELLATE_ATTACHMENT_PAGE',
      html: document.documentElement.innerHTML,
    },
  });
  if (upload.error) return;
  await dispatchBackgroundNotifier({
    action: 'showUpload',
    title: 'Page Successfully Uploaded',
    message: 'Attachment menu page uploaded to the public RECAP Archive.',
  });
  history.replaceState({ uploaded: true }, '');
};

AppellateDelegate.prototype.overrideDefaultForm = async function () {
  if (PACER.hasFilingCookie(document.cookie)) {
    let button = createRecapButtonForFilers(
      'Accept Charges and RECAP Document'
    );
    let spinner = createRecapSpinner();
    button.addEventListener('click', (event) => {
      event.preventDefault();
      let form = event.target.parentNode;
      form.id = 'form' + new Date().getTime();

      let spinner = document.getElementById('recap-button-spinner');
      if (spinner) spinner.classList.remove('recap-btn-spinner-hidden');

      window.postMessage({ id: form.id }, '*');
    });

    let form = document.querySelector('form');
    form.append(button);
    form.append(document.createTextNode('\u00A0'));
    form.append(spinner);
  } else {
    await overwriteFormSubmitMethod();
  }
};

AppellateDelegate.prototype.handleCombinedPdfPageView = async function () {
  // Find all `center` divs, which typically wrap receipt tables in lower
  // courts. However, in appellate courts, these divs can also wrap the entire
  // page content. To ensure an accurate count, we filter out nodes with more
  // than 3 child elements, as a full page container would likely have more
  // content.
  let transactionReceiptTables = Array.from(
    document.querySelectorAll('center')
  ).filter((row) => row.childElementCount <= 3);
  if (transactionReceiptTables.length === 0) return;

  // In appellate courts, we don't rely on an exclusion list like lower courts.
  // Instead, we extract document IDs from the URL parameters (`dls` attribute).
  // These IDs represent the files included on the current page.
  const urlParams = new URLSearchParams(window.location.search);
  let includeList = urlParams.get('dls') ? urlParams.get('dls').split(',') : [];

  // Count the number of receipt tables (from `transactionReceiptTables`) and
  // documents listed in the URL (`includeList`). If either count is greater
  // than 1, it indicates multiple documents are present. In this case, display
  // a warning message.
  if (
    transactionReceiptTables.length > 1 ||
    (includeList && includeList.length > 1)
  ) {
    const warning = combinedPdfWarning();
    document.body.appendChild(warning);
    return;
  }

  this.docId = await checkSingleDocInCombinedPDFPage(
    this.tabId,
    this.court,
    this.docId,
    true
  );
  // If no pacer_doc_id is available, exit this block to prevent unnecessary
  // page modifications intended for PDF retrieval.
  if (!this.docId) return;

  await this.overrideDefaultForm();

  // When we receive the message from the above submit method, submit the form
  // via XHR so we can get the document before the browser does.
  window.addEventListener(
    'message',
    this.onDocumentViewSubmit.bind(this),
    false
  );
};

// If this page offers a single document, intercept navigation to the document
// view page.
AppellateDelegate.prototype.handleSingleDocumentPageView = async function () {
  await this.overrideDefaultForm();

  this.pacer_case_id = await APPELLATE.getCaseId(
    this.tabId,
    this.queryParameters,
    this.docId
  );

  // Ensure a valid pacer_doc_id before proceeding.
  let input = document.querySelector('input[name=dls_id]');
  this.docId = this.docId || (input && input.value);

  // If no pacer_doc_id is available, exit this block to prevent unnecessary
  // page modifications intended for PDF retrieval.
  if (!this.docId) return;

  let title = document.querySelectorAll('strong')[1].innerHTML;
  let dataFromTitle = APPELLATE.parseReceiptPageTitle(title);
  this.docketNumber = dataFromTitle.docket_number;

  await updateTabStorage({
    [this.tabId]: {
      caseId: this.pacer_case_id,
      docketNumber: this.docketNumber,
    },
  });

  // When we receive the message from the above submit method, submit the form
  // via XHR so we can get the document before the browser does.
  window.addEventListener(
    'message',
    this.onDocumentViewSubmit.bind(this),
    false
  );

  let clCourt = PACER.convertToCourtListenerCourt(this.court);
  // submit fetch request through background worker
  const docData = await dispatchBackgroundFetch({
    action: 'getAvailabilityForDocuments',
    data: {
      docket_entry__docket__court: clCourt,
      pacer_doc_id__in: this.docId,
    },
  });
  if (docData.Error) return;

  console.info(
    'RECAP: Got results from API. Processing results to insert banner'
  );
  let result = docData.results.filter(
    (obj) => obj.pacer_doc_id == this.docId
  )[0];
  if (!result) return;

  insertAvailableDocBanner(result.filepath_local, 'body');
};

AppellateDelegate.prototype.onDocumentViewSubmit = async function (event) {
  // Security check to ensure message is from a PACER website.
  if (!PACER.getCourtFromUrl(event.origin)) {
    console.warn(
      'Received message from non PACER origin. This should only ' +
        'happen when the extension is being abused by a bad actor.'
    );
    return;
  }

  let previousPageHtml = copyPDFDocumentPage();
  let form = document.getElementById(event.data.id);

  let title = document.querySelectorAll('strong')[1].innerHTML;
  let pdfData = APPELLATE.parseReceiptPageTitle(title);

  // For multi-document pages, the title alone doesn't provide sufficient
  // information. Therefore, we need to extract additional data from the
  // receipt table to accurately identify the PDF.
  // Attempt to parse the necessary data from the receipt table.
  if (!pdfData) pdfData = APPELLATE.parseDataFromReceiptTable();

  // If we still don't have enough data after parsing the receipt table,
  // submit the form without retrieving the file.
  if (!pdfData) {
    form.submit();
    return;
  }

  if (!pdfData.att_number) {
    if (this.queryParameters.get('recapAttNum')) {
      pdfData.att_number = this.queryParameters.get('recapAttNum');
    } else {
      pdfData.att_number = await getAttachmentNumberFromPacerDocId(
        this.tabId,
        this.docId
      );
    }
  }

  if (pdfData.doc_number.length > 9) {
    // If the number is really big, it's probably a court that uses
    // pacer_doc_id instead of regular docket entry numbering.
    pdfData.doc_number = PACER.cleanPacerDocId(pdfData.doc_number);
  }

  $('body').css('cursor', 'wait');
  // The form method in multi-document pages is a GET request, while
  // single-document pages use a POST request. By checking the method here, we
  // can reuse this code to retrieve the PDF file and display it appropriately
  // for both page types.
  let queryString = new URLSearchParams(new FormData(form));
  let url = new URL(form.action);;
  let method = form.method.toUpperCase();
  let options = {};
  if (method == 'GET') {
    // If the method is GET, append query parameters to the URL
    queryString.forEach((value, key) => url.searchParams.append(key, value));
  } else {
    options['method'] = method;
    options['headers'] = {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    options['body'] = queryString.toString();
  }
  const resp = await window.fetch(url, options);
  let helperMethod = handleDocFormResponse.bind(this);
  helperMethod(
    resp.headers.get('Content-Type'),
    await resp.blob(),
    null,
    previousPageHtml,
    pdfData
  );
};

// Given the HTML for a page with an <iframe> in it, downloads the PDF
// document in the iframe, displays it in the browser, and also
// uploads the PDF document to RECAP.
AppellateDelegate.prototype.showPdfPage = async function (
  html,
  previousPageHtml,
  document_number,
  attachment_number,
  docket_number
) {
  let helperMethod = showAndUploadPdf.bind(this);
  await helperMethod(
    html,
    previousPageHtml,
    document_number,
    attachment_number,
    docket_number,
    this.docId
  );
};
