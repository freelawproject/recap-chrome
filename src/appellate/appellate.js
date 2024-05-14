//  Abstraction of scripts related to Appellate PACER to make them modular and testable.
let AppellateDelegate = function (tabId, court, url, path, links) {
  this.tabId = tabId;
  this.court = court;
  this.url = url;
  this.path = path;
  this.links = links || [];
  this.recap = importInstance(Recap);
  this.acms = importInstance(Acms);
  this.notifier = importInstance(Notifier);
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
  if (this.path.startsWith('/download-confirmation/')) {
    this.handleAcmsDownloadPage();
  } else if (this.path.match(/^\/[0-9\-]+$/)) {
    this.handleAcmsDocket();
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

AppellateDelegate.prototype.handleAcmsDocket = async function () {
  const processDocket = async () => {
    const caseSummary = JSON.parse(sessionStorage.caseSummary);
    const caseId = caseSummary.caseDetails.caseId;
    this.pacer_case_id = caseId;

    if (history.state && history.state.uploaded) {
      return;
    }

    const options = await getItemsFromStorage('options');
    if (!options['recap_enabled']) {
      console.info('RECAP: Not uploading docket json. RECAP is disabled.');
      return;
    }

    this.recap.uploadDocket(
      this.court,
      this.pacer_case_id,
      sessionStorage.caseSummary,
      'ACMS_DOCKET_JSON',
      (ok) => {
        if (ok) {
          history.replaceState({ uploaded: true }, '');
          this.notifier.showUpload(
            'Docket uploaded to the public RECAP Archive.',
            () => {}
          );
        } else {
          console.log('cb fail');
        }
      }
    );
  };

  const insertRecapButton = () => {
    // Query the first table with case data and insert the RECAP actions button
    let caseInformationTable = document.querySelector('table.case-information');
    // Get a reference to the parent node
    const parentDiv = caseInformationTable.parentNode;
    const existingActionButton = document.getElementById('recap-action-button');
    if (!existingActionButton) {
      let button = recapActionsButton(this.court, this.pacer_case_id, false);
      parentDiv.insertBefore(button, caseInformationTable);
    }

    this.recap.getAvailabilityForDocket(
      this.court,
      this.pacer_case_id,
      null,
      (result) => {
        if (result.count === 0) {
          console.warn('RECAP: Zero results found for docket lookup.');
        } else if (result.count > 1) {
          console.error(
            'RECAP: More than one result found for docket lookup. Found' +
              `${result.count}`
          );
        } else {
          addAlertButtonInRecapAction(this.court, this.pacer_case_id);
          let cl_id = getClIdFromAbsoluteURL(result.results[0].absolute_url);
          addSearchDocketInRecapAction(cl_id);
        }
      }
    );
  };

  const attachLinkToDocs = async () => {
    // Get the docket info from the sessionStorage obj
    const caseSummary = JSON.parse(sessionStorage.caseSummary);
    const docketEntries = caseSummary.docketInfo.docketEntries;

    // Get all the entry links on the page. We use the "entry-link"
    // class as a selector because we observed that all non-restricted
    // entries consistently use this class.
    this.links = document.body.querySelectorAll('.entry-link');
    if (!links.length) {
      return;
    }

    // Go through the array of links and collect the doc IDs of
    // the entries that are not restricted.
    let docIds = [];
    for (link of this.links) {
      const docketEntryText = link.innerHTML.trim();
      const docketEntryData = docketEntries.find(
        (entry) => entry.entryNumber == parseInt(docketEntryText)
      );

      // Embed the pacer_doc_id as a data attribute within the anchor tag
      // to facilitate subsequent retrieval based on this identifier.
      link.dataset.pacerDocId = docketEntryData.docketEntryId;

      // add the id to the array of doc ids
      docIds.push(docketEntryData.docketEntryId);
    }

    // Ask the server whether any of these documents are available from RECAP.
    this.recap.getAvailabilityForDocuments(docIds, this.court, (response) => {
      for (result of response.results) {
        let doc_id = result.pacer_doc_id;
        // Query the docket entry link using the data attribute
        // attached previously
        let anchor = document.querySelector(`[data-pacer-doc-id="${doc_id}"]`);
        // Create the RECAP icon
        let href = `https://storage.courtlistener.com/${result.filepath_local}`;
        let recap_link = $('<a/>', {
          title: 'Available for free from the RECAP Archive.',
          href: href,
        });
        recap_link.append(
          $('<img/>').attr({
            src: chrome.extension.getURL('assets/images/icon-16.png'),
          })
        );
        let recap_div = $('<div>', {
          class: 'recap-inline-appellate',
        });
        recap_div.append(recap_link);
        // Insert the RECAP icon next to the docket entry link
        recap_div.insertAfter(anchor);
      }
      let spinner = document.getElementById('recap-button-spinner');
      if (spinner) {
        spinner.classList.add('recap-btn-spinner-hidden');
      }
    });
  };

  // Since this page uses Vue.js for dynamic data rendering and shows a loader
  // during API requests, an observer is necessary to monitor DOM changes and
  // update the component accordingly.
  const footerObserver = async (mutationList, observer) => {
    for (const r of mutationList) {
      // We could restrict this to div#box, but that feels overspecific
      for (const a of r.addedNodes) {
        // We use the the footer element as an indicator that the entire page
        // has finished loading.
        if (a.localName === 'footer') {
          if ('caseSummary' in sessionStorage) {
            processDocket();
            attachLinkToDocs();
            insertRecapButton();
            observer.disconnect();
          } else {
            console.log(
              'We observed a <footer> being added, but no ' +
                'sessionStorage.caseSummary; this is unexpected.'
            );
          }
        }
      }
    }
  };

  const footer = document.querySelector('footer');
  // Checks whether the footer is rendered or not, indicating that the page
  // has fully loaded. Once confirmed, proceed with reloading the RECAP icons.
  // This check is particularly useful when users click the 'Refresh RECAP
  // links' option in the RECAP button, because the page is not reloaded and
  // there are no changes being made to the DOM.
  if (footer){
    attachLinkToDocs();
  } else {
    const body = document.querySelector('body');
    const observer = new MutationObserver(footerObserver);
    observer.observe(body, { subtree: true, childList: true });
  }
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
          : 0,
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
    // Use the  to request the PDF doc
    this.acms.getDocumentURL(ApiUrl, Token, pdfFileRequestBody, (pdf_url) => {
      httpRequest(
        pdf_url,
        null,
        null,
        function (type, ab, xhr) {
          let requestHandler = handleDocFormResponse.bind(this);
          requestHandler(type, ab, xhr, previousPageHtml, documentData);
        }.bind(this)
      );
    });
  }

  const wrapperMutationObserver = (mutationList, observer) => {
    for (const r of mutationList) {
      for (const n of r.addedNodes) {
        let hasReceipt = n.textContent
          .toLowerCase()
          .includes('transaction receipt');

        let hasAcceptChargesButton = n.textContent
          .toLowerCase()
          .includes('accept charges and retrieve');

        if (n.localName === 'div' && hasReceipt && hasAcceptChargesButton) {
          // Insert script to retrieve and store Vue data in the storage
          APPELLATE.storeVueDataInSession();

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
          this.recap.getAvailabilityForDocuments(
            [this.docId],
            this.court,
            (api_results) => {
              console.info(
                'RECAP: Got results from API. Running callback on API ' +
                  'results to insert banner'
              );
              let result = api_results.results.filter(
                (obj) => obj.pacer_doc_id == this.docId,
                this
              )[0];
              if (!result) {
                return;
              }
              insertAvailableDocBanner(result.filepath_local, 'div.box');
            }
          );
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
  if (!PACER.hasFilingCookie(document.cookie)) {
    return;
  }

  form = document.querySelector('form');
  if (!document.querySelector('.recap-email-banner-full')) {
    form.appendChild(recapEmailBanner('recap-email-banner-full'));
  }
};

AppellateDelegate.prototype.handleDocketReportFilter = function () {
  if (!this.docketNumber) {
    return;
  }
  let docketNumberCore = PACER.makeDocketNumberCore(this.docketNumber);

  this.recap.getAvailabilityForDocket(this.court, null, docketNumberCore, (result) => {
    if (result.count === 1 && result.results) {
      let form = document.getElementsByTagName('form')[0];
      let banner = recapBanner(result.results[0]);
      let recapAlert = document.createElement('div');
      recapAlert.classList.add('recap-banner');
      recapAlert.appendChild(recapAlertButton(this.court, this.pacer_case_id, true));
      form.after(recapAlert);
      form.after(banner);
    } else {
      PACER.handleDocketAvailabilityMessages(result);
    }
  });
};

AppellateDelegate.prototype.handleCaseSelectionPage = async function () {
  if (document.querySelectorAll('input:not([type=hidden])').length) {
    // When the users go back to the Case Selection Page from the Docket Report using the back button
    // Appellate PACER loads the Case Search Page instead but in the HTML body has the servlet hidden input
    // and shows 'CaseSelectionTable.jsp' as its value.
    //
    // This check avoids sending pages like the one previously described to the API.
    if (!PACER.hasFilingCookie(document.cookie)) {
      return;
    }

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

    this.recap.getAvailabilityForDocket(this.court, this.pacer_case_id, null, (result) => {
      if (result.count === 1 && result.results) {
        PACER.removeBanners();

        const footer = document.querySelector('div.noprint:last-of-type');
        const div = document.createElement('div');
        div.classList.add('recap-banner');
        div.appendChild(recapAlertButton(this.court, this.pacer_case_id, true));
        footer.before(div);

        const rIcon = APPELLATE.makeRButtonForCases(result.results[0].absolute_url);
        const appellateLink = anchors[0];
        rIcon.insertAfter(appellateLink);
      } else {
        PACER.handleDocketAvailabilityMessages(result);
      }
    });

    if (anchors.length == 3) {
      let districtLink = anchors[anchors.length - 1];
      let districtLinkData = APPELLATE.getDatafromDistrictLinkUrl(districtLink.href);
      this.recap.getAvailabilityForDocket(
        districtLinkData.court,
        null,
        districtLinkData.docket_number_core,
        (result) => {
          if (result.count === 1 && result.results) {
            const rIcon = APPELLATE.makeRButtonForCases(result.results[0].absolute_url);
            rIcon.insertAfter(districtLink);
          } else {
            PACER.handleDocketAvailabilityMessages(result);
          }
        }
      );
    }
  } else {
    // Add the pacer_case_id to each docket link to use it in the docket report
    APPELLATE.addCaseIdToDocketSummaryLink();
  }

  const options = await getItemsFromStorage('options');

  if (!options['recap_enabled']) {
    console.info('RECAP: Not uploading case selection page. RECAP is disabled.');
    return;
  }

  let callback = (ok) => {
    if (ok) {
      history.replaceState({ uploaded: true }, '');
      this.notifier.showUpload('Case selection page uploaded to the public RECAP Archive.', function () {});
    }
  };

  this.recap.uploadIQueryPage(
    this.court,
    this.pacer_case_id,
    document.documentElement.innerHTML,
    'APPELLATE_CASE_QUERY_RESULT_PAGE',
    callback
  );
};

// Upload the case query page to RECAP
AppellateDelegate.prototype.handleCaseQueryPage = async function () {
  this.pacer_case_id = await APPELLATE.getCaseId(this.tabId, this.queryParameters, this.docId);

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

  if (options['recap_enabled']) {
    let callback = (ok) => {
      if (ok) {
        history.replaceState({ uploaded: true }, '');
        this.notifier.showUpload('Case query page uploaded to the public RECAP Archive.', function () {});
      }
    };

    this.recap.uploadDocket(
      this.court,
      this.pacer_case_id,
      document.documentElement.innerHTML,
      'APPELLATE_CASE_QUERY_PAGE',
      (ok) => callback(ok)
    );
  }
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
  let { links, docsToCases } = APPELLATE.findDocLinksFromAnchors(
    this.links,
    this.tabId,
    this.queryParameters,
    this.docketNumber
  );

  this.pacer_case_id = this.pacer_case_id
    ? this.pacer_case_id
    : await APPELLATE.getCaseId(this.tabId, this.queryParameters, this.docId, this.docketNumber);

  if (this.pacer_case_id && this.docId) {
    docsToCases[this.docId] = this.pacer_case_id;
  }

  updateTabStorage({
    [this.tabId]: {
      caseId: this.pacer_case_id,
      docketNumber: this.docketNumber,
      docsToCases: docsToCases,
    },
  });

  let linkCount = links.length;
  console.info(`RECAP: Attaching links to all eligible documents (${linkCount} found)`);
  if (linkCount === 0) {
    return;
  }

  // Ask the server whether any of these documents are available from RECAP.
  this.recap.getAvailabilityForDocuments(
    links,
    this.court,
    $.proxy(function (api_results) {
      console.info(
        `RECAP: Got results from API. Running callback on API results to ` + `attach links and icons where appropriate.`
      );
      for (let i = 0; i < this.links.length; i++) {
        let pacer_doc_id = this.links[i].dataset.pacerDocId;
        if (!pacer_doc_id) {
          continue;
        }
        let result = api_results.results.filter(function (obj) {
          return obj.pacer_doc_id === pacer_doc_id;
        })[0];

        if (!result) {
          continue;
        }
        let href = `https://storage.courtlistener.com/${result.filepath_local}`;
        let recap_link = $('<a/>', {
          title: 'Available for free from the RECAP Archive.',
          href: href,
        });
        recap_link.append(
          $('<img/>').attr({
            src: chrome.extension.getURL('assets/images/icon-16.png'),
          })
        );
        let recap_div = $('<div>', {
          class: 'recap-inline-appellate',
        });
        recap_div.append(recap_link);
        recap_div.insertAfter(this.links[i]);
      }
      let spinner = document.getElementById('recap-button-spinner');
      if (spinner) {
        spinner.classList.add('recap-btn-spinner-hidden');
      }
    }, this)
  );
};

AppellateDelegate.prototype.handleDocketDisplayPage = async function () {
  this.pacer_case_id = await APPELLATE.getCaseId(this.tabId, this.queryParameters, this.docId, this.docketNumber);

  if (!this.pacer_case_id) {
    return;
  }

  // Query the first table with case data and insert the RECAP actions button
  let table = document.querySelectorAll('table')[3];
  const existingActionButton = document.getElementById('recap-action-button');
  if (!existingActionButton) {
    let button = recapActionsButton(this.court, this.pacer_case_id, false);
    table.after(button);
  }

  this.recap.getAvailabilityForDocket(this.court, this.pacer_case_id, null, (result) => {
    if (result.count === 0) {
      console.warn('RECAP: Zero results found for docket lookup.');
    } else if (result.count > 1) {
      console.error(`RECAP: More than one result found for docket lookup. Found ${result.count}`);
    } else {
      addAlertButtonInRecapAction(this.court, this.pacer_case_id);
      let cl_id = getClIdFromAbsoluteURL(result.results[0].absolute_url);
      addSearchDocketInRecapAction(cl_id);
    }
  });

  // if you've already uploaded the page, return
  if (history.state && history.state.uploaded) {
    return;
  }

  const options = await getItemsFromStorage('options');

  if (options['recap_enabled']) {
    let callback = (ok) => {
      if (ok) {
        addAlertButtonInRecapAction(this.court, this.pacer_case_id);
        history.replaceState({ uploaded: true }, '');
        this.notifier.showUpload('Docket uploaded to the public RECAP Archive.', function () {});
      }
    };

    this.recap.uploadDocket(
      this.court,
      this.pacer_case_id,
      document.documentElement.innerHTML,
      'APPELLATE_DOCKET',
      (ok) => callback(ok)
    );
  } else {
    console.info(`RECAP: Not uploading docket. RECAP is disabled.`);
  }
};

AppellateDelegate.prototype.handleAttachmentPage = async function () {
  this.pacer_case_id = await APPELLATE.getCaseId(this.tabId, this.queryParameters, this.docId);

  if (!this.pacer_case_id) {
    return;
  }

  if (history.state && history.state.uploaded) {
    return;
  }

  const options = await getItemsFromStorage('options');
  if (!options['recap_enabled']) {
    console.info(`RECAP: Not uploading attachment page. RECAP is disabled.`);
    return;
  }

  let callback = (ok) => {
    if (ok) {
      history.replaceState({ uploaded: true }, '');
      this.notifier.showUpload('Attachment menu page uploaded to the public RECAP Archive.', function () {});
    }
  };

  this.recap.uploadAttachmentMenu(
    this.court,
    this.pacer_case_id,
    document.documentElement.innerHTML,
    'APPELLATE_ATTACHMENT_PAGE',
    (ok) => callback(ok)
  );
};

AppellateDelegate.prototype.handleCombinedPdfPageView = async function () {
  let warning = combinedPdfWarning()
  document.body.appendChild(warning)
};

// If this page offers a single document, intercept navigation to the document view page.
AppellateDelegate.prototype.handleSingleDocumentPageView = async function () {
  if (PACER.hasFilingCookie(document.cookie)) {
    let button = createRecapButtonForFilers('Accept Charges and RECAP Document');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      let form = event.target.parentNode;
      form.id = 'form' + new Date().getTime();
      window.postMessage({ id: form.id }, '*');
    });

    let form = document.querySelector('form');
    form.append(button);
  } else {
    overwriteFormSubmitMethod();
  }

  this.pacer_case_id = await APPELLATE.getCaseId(this.tabId, this.queryParameters, this.docId);

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
  window.addEventListener('message', this.onDocumentViewSubmit.bind(this), false);

  let callback = $.proxy(function (api_results) {
    console.info(`RECAP: Got results from API. Running callback on API results to ` + `insert banner`);
    let result = api_results.results.filter((obj) => obj.pacer_doc_id == this.docId, this)[0];

    if (!result) {
      return;
    }

    insertAvailableDocBanner(result.filepath_local, 'body');
  }, this);

  this.recap.getAvailabilityForDocuments([this.docId], this.court, callback);
};

AppellateDelegate.prototype.onDocumentViewSubmit = function (event) {
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
  let dataFromTitle = APPELLATE.parseReceiptPageTitle(title);

  if (dataFromTitle.att_number == 0 && this.queryParameters.get('recapAttNum')) {
    dataFromTitle.att_number = this.queryParameters.get('recapAttNum');
  }

  if (dataFromTitle.doc_number.length > 9) {
    // If the number is really big, it's probably a court that uses
    // pacer_doc_id instead of regular docket entry numbering.
    dataFromTitle.doc_number = PACER.cleanPacerDocId(dataFromTitle.doc_number);
  }

  if (!dataFromTitle) {
    form.submit();
    return;
  }
  $('body').css('cursor', 'wait');
  let query_string = new URLSearchParams(new FormData(form)).toString();
  httpRequest(
    form.action,
    query_string,
    'application/x-www-form-urlencoded',
    function (type, ab, xhr) {
      let requestHandler = handleDocFormResponse.bind(this);
      requestHandler(type, ab, xhr, previousPageHtml, dataFromTitle);
    }.bind(this)
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
  await helperMethod(html, previousPageHtml, document_number, attachment_number, docket_number, this.docId);
};
