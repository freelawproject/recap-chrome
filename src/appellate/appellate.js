//  Abstraction of scripts related to Appellate PACER to make them modular and testable.
let AppellateDelegate = function (tabId, court, url, links) {
  this.tabId = tabId;
  this.court = court;
  this.url = url;
  this.links = links || [];
  this.recap = importInstance(Recap);
  this.notifier = importInstance(Notifier);
  this.queryParameters = APPELLATE.getQueryParameters(this.url);
  this.docId = APPELLATE.getDocIdFromURL(this.queryParameters);
  this.docketNumber = APPELLATE.getDocketNumber(this.queryParameters);
};

// Identify the current page using the URL and the query string,
// then dispatch the associated handler
AppellateDelegate.prototype.dispatchPageHandler = function () {
  let targetPage = this.queryParameters.get('servlet') || APPELLATE.getServletFromInputs();
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

// If this page offers a single document, intercept navigation to the document view page.
AppellateDelegate.prototype.handleSingleDocumentPageView = async function () {
  overwriteFormSubmitMethod();

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
