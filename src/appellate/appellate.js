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
        if (node.id === 'indexContent') {
          this.handleAcmsDocket();
        }
        if (node.classList.contains('documents-list-wrapper')) {
          this.handleAcmsAttachmentPage();
        }
      }
    }
  };

  // If ACMS has already rendered the main content container (indexContent),
  // we can immediately initialize the docket handler without waiting for
  // HTMX updates. This prevents unnecessary observer creation and avoids
  // double-handling when navigating back/forward.
  if (document.getElementById('indexContent')) {
    this.handleAcmsDocket();
  } else {
    // Otherwise, the page is still loading partial content via HTMX.
    // Set up a MutationObserver on <body> to detect when ACMS injects
    // the relevant sections.
    const body = document.querySelector('body');
    const observer = new MutationObserver(pageObserver);
    observer.observe(body, { subtree: true, childList: true });
  }
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
  const processAttachmentPage = async () => {
    let caseSummary = JSON.parse(sessionStorage.caseSummary);
    this.pacer_case_id = caseSummary.caseDetails.caseId;

    const options = await getItemsFromStorage('options');
    if (!options['recap_enabled']) {
      return console.info(
        'RECAP: Not uploading docket json. RECAP is disabled.'
      );
    }

    let vueData = JSON.parse(sessionStorage.recapVueData);
    let requestBody = {
      caseDetails: caseSummary.caseDetails,
      docketEntry: vueData.docketEntry,
      docketEntryDocuments: vueData.docketEntryDocuments,
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

  const attachLinkToDocs = async () => {
    // This function attaches links to available RECAP documents for each entry
    // on the current page. It performs the following steps:
    //
    // 1. Retrieves docket entry and document data from session storage.
    // 2. Selects all elements with the class "entry-link" on the page.
    // 3. Loops through each link:
    //    - Extracts the document number from the previous sibling element.
    //    - Finds the corresponding document data object using the document
    //      number.
    //    - Embeds the document's `docketDocumentDetailsId` as a
    //      `data-document-guid` attribute in the link.
    // 4. Queries the server for the availability of these documents from RECAP.
    // 5. Iterates through the response:
    //    - Extracts the `acms_document_guid` for each available document.
    //    - Finds the corresponding link element using the previously attached
    //     `data-document-guid` attribute.
    //    - Creates a link element
    //    - Inserts the RECAP icon element next to the original entry link.
    const attachmentsData = JSON.parse(sessionStorage.recapVueData);
    const documentsData = attachmentsData.docketEntryDocuments;

    // Get all the entry links on the page. We use the "entry-link"
    // class as a selector because all rows on the page
    // consistently use this class.
    this.links = document.body.querySelectorAll('.entry-link');
    if (!links.length) return;

    // Go through the array of links and embed the document_guid
    for (link of this.links) {
      // The document number and the link are enclosed within the
      // same span tag and are located adjacent to each other.
      // Therefore, to retrieve the document number, we need to use
      //  the previousSibling property.
      let documentNumberText = link.previousSibling.innerHTML.trim();
      const docData = documentsData.find(
        (document) => document.documentNumber == documentNumberText
      );

      // Embed the document_guid as a data attribute within the anchor tag
      // to facilitate subsequent retrieval based on this identifier.
      link.dataset.documentGuid = docData.docketDocumentDetailsId;
    }

    let docIds = [attachmentsData.docketEntry.docketEntryId];
    let clCourt = PACER.convertToCourtListenerCourt(this.court);
    // Ask the server whether any of these documents are available from RECAP.
    const recapLinks = await dispatchBackgroundFetch({
      action: 'getAvailabilityForDocuments',
      data: {
        docket_entry__docket__court: clCourt,
        pacer_doc_id__in: docIds.join(','),
      },
    });
    for (result of recapLinks.results) {
      let doc_guid = result.acms_document_guid;
      // Query the docket entry link using the data attribute
      // attached previously
      let anchor = document.querySelector(
        `[data-document-guid="${doc_guid}"]`
      );
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
      // Insert the RECAP icon next to the docket entry link
      recap_div.insertAfter(anchor);
    }
  };

  // This following logic monitors for specific DOM changes using
  // MutationObserver. It iterates through mutations and checks for added nodes
  // that meet two criteria:
  //   1. The node's text content (lowercase) includes "documents are attached
  //      to this filing".
  //   2. The node's parent element is an h4 element.
  // If both conditions are true, it triggers these actions:
  //   - Stores relevant Vue data in session storage.
  //   - Processes the current page as an attachment page.
  //   - Attaches links to entries on the page.
  const wrapperMutationObserver = async (mutationList, observer) => {
    for (const r of mutationList) {
      for (const n of r.addedNodes) {
        let isTitle = n.textContent
          .toLowerCase()
          .includes('documents are attached to this filing');
        let isTargetingH4Div = n.parentElement.localName === 'h4';
        if (isTitle && isTargetingH4Div) {
          // Insert script to retrieve and store Vue data in the storage
          await APPELLATE.storeVueDataInSession();
          processAttachmentPage();
          attachLinkToDocs();
        }
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
    if (!links.length) return;

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

  async function startUploadProcess() {
    // This function initiates the upload process for a PDF document.
    // It performs the following steps:
    //
    // 1. Prepares data for upload:
    //    - Parses download data from session storage and creates a request
    //      body for the PDF URL document.
    //
    // 2. Retrieves configuration and tokens:
    //    - Extracts API URL and token from session storage stored in
    //      the 'recapACMSConfiguration' key.
    //
    // 3. Extracts document information:
    //    - Extracts title from the element with class 'p.font-weight-bold'.
    //    - Parses relevant details (att_number) from the title.
    //    - Builds a documentData object containing docket number, document
    //      number, and attachment number.
    //
    // 4. Adds a loading message:
    //    - Creates a loading message using APPELLATE.createsLoadingMessage.
    //
    // 5. Stores case ID and document GUID (assumed for later use):
    //    - Saves case ID from download data.
    //    - Saves document GUID from download data.
    //
    // 6. Gets PDF download URL and initiates download:
    //    - Stores the current page HTML content.
    //    - Calls acms.getDocumentURL to get the PDF download URL.
    //    - Once the URL is retrieved, initiates an HTTP request to download
    //      the PDF.
    //    - Binds the handleDocFormResponse function to handle the downloaded
    //      data and document information after download completes.
    let downloadData = JSON.parse(
      sessionStorage.getItem('recapVueData')
    );
    const pdfFileRequestBody =
      APPELLATE.createAcmsDocumentRequestBody(downloadData);

    // Get the ACMS API URL and token from the sessionStorage object
    let appConfiguration = JSON.parse(
      sessionStorage.getItem('recapACMSConfiguration')
    );
    let { ApiUrl } = appConfiguration.AppSettings;
    let { Token } = appConfiguration.AuthToken;

    // Collect relevant document information to upload PDF to CL
    let title = document.querySelector('p.font-weight-bold').innerHTML.trim();
    let dataFromTitle = APPELLATE.parseReceiptPageTitle(title);
    let documentData = {
      docket_number: downloadData.caseSummary.caseDetails.caseNumber,
      doc_number: downloadData.docketEntry.entryNumber,
      att_number:
        downloadData.docketEntry.documentCount > 1
          ? dataFromTitle.att_number
          : null,
    };

    // Remove element from the page to show loading message
    let mainDiv = document.querySelector('.download-confirmation-wrapper');
    mainDiv.innerHTML = '';
    loadingTextMessage = APPELLATE.createsLoadingMessage(downloadData);
    mainDiv.append(loadingTextMessage);

    // Get the pacer_case_id and document GUID from the sessionStorage object
    this.pacer_case_id = downloadData.caseSummary.caseDetails.caseId;
    this.acmsDocumentGuid =
      downloadData.docketEntryDocuments[0].docketDocumentDetailsId;

    let previousPageHtml = document.documentElement.innerHTML;
    let pdf_url = await APPELLATE.fetchAcmsDocumentUrl({
      apiUrl: ApiUrl,
      token: Token,
      mergePdfFilesRequest: pdfFileRequestBody,
    });
    const resp = await window.fetch(pdf_url, { method: 'GET' });
    let requestHandler = handleDocFormResponse.bind(this);
    requestHandler(
      resp.headers.get('Content-Type'),
      await resp.blob(),
      null,
      previousPageHtml,
      documentData
    );
  }

  const wrapperMutationObserver = async (mutationList, observer) => {
    for (const r of mutationList) {
      for (const n of r.addedNodes) {
        let hasReceipt = n.textContent
          .toLowerCase()
          .includes('transaction receipt');

        let hasAcceptChargesButton = n.textContent
          .toLowerCase()
          .includes('accept charges and retrieve');

        // The `selectedDocuments` key in sessionStorage is only available when
        // the download page is loaded from an attachment page. It is not
        // available when loaded from a case summary entry. This check ensures
        // the extension can handle both scenarios gracefully.
        let hasOneDocument = true;
        if (sessionStorage.getItem('selectedDocuments')) {
          hasOneDocument =
            JSON.parse(sessionStorage.selectedDocuments).length == 1;
        }

        if (
          n.localName === 'div' &&
          hasReceipt &&
          hasAcceptChargesButton
        ) {
          if (!hasOneDocument) {
            pdfWarning = combinedPdfWarning();
            n.append(pdfWarning);
            return;
          }

          // Insert script to retrieve and store Vue data in the storage
          await APPELLATE.storeVueDataInSession();

          // Get doc_id from the sessionStorage
          let downloadData = JSON.parse(sessionStorage.getItem('recapVueData'));
          this.docId = downloadData.docketEntry.docketEntryId;

          // Check if the accept charges button is already created on the page
          let acceptChargesButton = document.querySelector('button');
          if (!acceptChargesButton) {
            return;
          }

          // Clone the "Accept charges" button to remove the onclick event.
          // The default event handler retrieves an URL for the PDF and then
          // navigate to this page, but if we wait until the handler finishes,
          // we wont be able to use the same link to get the doc as a blob
          // object because the URL seems to be a one-time-use link and
          // attempting to access it after the handler has used it will result
          // in an error message stating that the file retrieval attempt failed.
          let clonedAcceptChargesButton = acceptChargesButton.cloneNode(true);
          acceptChargesButton.replaceWith(clonedAcceptChargesButton);

          // Add a custom onclick event to the Accept charges button.
          // The handler of this new event performs an additional task before
          // displaying the document. Upon clicking the button, the document
          // retrieval process will remain unchanged, but the retrieved blob
          // object will be uploaded to the RECAP archive before the document
          // is rendered on the page.
          clonedAcceptChargesButton.addEventListener(
            'click',
            startUploadProcess.bind(this)
          );

          // Query the server to check the availability of the document in the
          // RECAP archive.
          let clCourt = PACER.convertToCourtListenerCourt(this.court);
          const recapLinks = await dispatchBackgroundFetch({
            action: 'getAvailabilityForDocuments',
            data: {
              docket_entry__docket__court: clCourt,
              pacer_doc_id__in: this.docId,
            },
          });
          // return if there are no results
          if (!recapLinks)
            return console.error(
              'RECAP: Failed getting availability for dockets.'
            );

          console.info(
            'RECAP: Got results from API. Processing results to insert banner'
          );
          // To accurately identify ACMS documents, we should prioritize the
          // `ACMS document details ID` stored in browser sessionStorage over
          // the docket entry ID. This is because ACMS often uses the same URL
          // for different attachments, making it ambiguous for identification
          // purposes.
          let acms_doc_id =
            downloadData.docketEntryDocuments[0].docketDocumentDetailsId;
          let result = recapLinks.results.filter(
            (obj) => obj.acms_document_guid == acms_doc_id,
            this
          )[0];
          if (!result) return;
          insertAvailableDocBanner(result.filepath_local, 'div.box');
        }
      };
    };
  };

  const wrapper = document.getElementsByClassName(
    'download-confirmation-wrapper'
  )[0];
  const observer = new MutationObserver(wrapperMutationObserver);
  observer.observe(wrapper, { subtree: true, childList: true });
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
