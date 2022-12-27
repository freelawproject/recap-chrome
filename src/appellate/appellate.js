//  Abstraction of scripts related to Appellate PACER to make them modular and testable.
let AppellateDelegate = function (tabId, court, url, links) {
  this.tabId = tabId;
  this.court = court;
  this.url = url;
  this.links = links || [];
  this.recap = importInstance(Recap);
  this.notifier = importInstance(Notifier);
  this.queryParameters = APPELLATE.getQueryParameters(this.url);
  this.docId = APPELLATE.getDocIdFromServlet(this.queryParameters.get('servlet'));
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

AppellateDelegate.prototype.handleCaseSelectionPage = async function () {
  if (document.querySelectorAll('input:not([type=hidden])').length) {
    // When the users go back to the Case Selection Page from the Docket Report using the back button
    // Appellate PACER loads the Case Search Page instead but in the HTML body has the servlet hidden input
    // and shows 'CaseSelectionTable.jsp' as its value.
    //
    // This check avoids sending pages like the one previously described to the API.
    return;
  }

  if (APPELLATE.caseSelectionPageHasOneRow()) {
    // Retrieve pacer_case_id from the Case Query link
    this.pacer_case_id = APPELLATE.getCaseIdFromCaseSelection();
    await saveCaseIdinTabStorage({ tabId: this.tabId }, this.pacer_case_id);
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
  let { links, docsToCases } = APPELLATE.findDocLinksFromAnchors(this.links);

  this.pacer_case_id = this.pacer_case_id
    ? this.pacer_case_id
    : await APPELLATE.getCaseId(this.tabId, this.queryParameters, this.docId);

  if (this.pacer_case_id && this.docId) {
    docsToCases[this.docId] = this.pacer_case_id;
  }

  updateTabStorage({
    [this.tabId]: {
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
        let pacer_doc_id = $(this.links[i]).data('pacer_doc_id');
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
  this.pacer_case_id = await APPELLATE.getCaseId(this.tabId, this.queryParameters, this.docId);

  if (!this.pacer_case_id) {
    return;
  }

  await saveCaseIdinTabStorage({ tabId: this.tabId }, this.pacer_case_id);

  // Query the first table with case data and insert the RECAP actions button
  let table = document.querySelectorAll('table')[3];
  let button = recapActionsButton(this.court, this.pacer_case_id, false);
  table.after(button);

  this.recap.getAvailabilityForDocket(this.court, this.pacer_case_id, (result) => {
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
  await saveCaseIdinTabStorage({ tabId: this.tabId }, this.pacer_case_id);

  // When we receive the message from the above submit method, submit the form
  // via XHR so we can get the document before the browser does.
  window.addEventListener('message', this.onDocumentViewSubmit.bind(this), false);

  let callback = $.proxy(function (api_results) {
    console.info(`RECAP: Got results from API. Running callback on API results to ` + `insert link`);
    let result = api_results.results.filter((obj) => obj.pacer_doc_id == this.docId, this)[0];

    if (!result) {
      return;
    }

    let href = `https://www.courtlistener.com/${result.filepath_local}`;
    // Insert a RECAP download link at the bottom of the form.
    $('<div class="recap-banner"/>')
      .append(
        $('<a/>', {
          title: 'Document is available for free in the RECAP Archive.',
          href: href,
        })
          .append($('<img/>', { src: chrome.extension.getURL('assets/images/icon-16.png') }))
          .append(' Get this document for free from the RECAP Archive.')
      )
      .appendTo($('body'));
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
      console.info(`RECAP: Successfully submitted RECAP "View" button form: ${xhr.statusText}`);

      const blob = new Blob([new Uint8Array(ab)], { type: type });
      // If we got a PDF, we wrap it in a simple HTML page.  This lets us treat
      // both cases uniformly: either way we have an HTML page with an <iframe>
      // in it, which is handled by showPdfPage.
      if (type === 'application/pdf') {
        // canb and ca9 return PDFs and trigger this code path.
        let html = APPELLATE.getFullPageIframe(URL.createObjectURL(blob));
        this.showPdfPage(
          document.documentElement,
          html,
          previousPageHtml,
          dataFromTitle.doc_number,
          dataFromTitle.att_number,
          dataFromTitle.docket_number
        );
      } else {
        const reader = new FileReader();
        reader.onload = function () {
          let html = reader.result;
          // check if we have an HTML page which redirects the user to the PDF
          // this was first display by the Northern District of Georgia
          // https://github.com/freelawproject/recap/issues/277
          const redirectResult = Array.from(html.matchAll(/window\.location\s*=\s*["']([^"']+)["'];?/g));
          if (redirectResult.length > 0) {
            const url = redirectResult[0][1];
            html = APPELLATE.getFullPageIframe(url);
          }
          this.showPdfPage(
            document.documentElement,
            html,
            previousPageHtml,
            dataFromTitle.doc_number,
            dataFromTitle.att_number,
            dataFromTitle.docket_number
          );
        }.bind(this);
        reader.readAsText(blob); // convert blob to HTML text
      }
    }.bind(this)
  );
};

// Given the HTML for a page with an <iframe> in it, downloads the PDF
// document in the iframe, displays it in the browser, and also
// uploads the PDF document to RECAP.
AppellateDelegate.prototype.showPdfPage = async function (
  documentElement,
  html,
  previousPageHtml,
  document_number,
  attachment_number,
  docket_number
) {
  // Find the <iframe> URL in the HTML string.
  let match = html.match(/([^]*?)<iframe[^>]*src="(.*?)"([^]*)/);
  if (!match) {
    document.documentElement.innerHTML = html;
    return;
  }

  const options = await getItemsFromStorage('options');

  showWaitingMessage(match);

  // Make the Back button redisplay the previous page.
  window.onpopstate = function (event) {
    if (event.state.content) {
      document.documentElement.innerHTML = event.state.content;
    }
  };
  history.replaceState({ content: previousPageHtml }, '');

  let blob = await downloadDataFromIframe(match, this.tabId);
  let blobUrl = URL.createObjectURL(blob);
  let pacer_case_id;

  if (attachment_number) {
    pacer_case_id = this.pacer_case_id
      ? this.pacer_case_id
      : await APPELLATE.getCaseId(this.tabId, this.queryParameters, this.docId);
  } else {
    pacer_case_id = this.pacer_case_id
      ? this.pacer_case_id
      : await getPacerCaseIdFromPacerDocId(this.tabId, this.docId);
  }

  let filename = generateFileName(
    options,
    this.court,
    pacer_case_id,
    docket_number,
    document_number,
    attachment_number
  );
  displayPDFOrSaveIt(options, filename, match, blob, blobUrl);

  if (options['recap_enabled']) {
    // If we have the pacer_case_id, upload the file to RECAP.
    // We can't pass an ArrayBuffer directly to the background
    // page, so we have to convert to a regular array.
    this.recap.uploadDocument(this.court, pacer_case_id, this.docId, document_number, attachment_number, (ok) => {
      // callback
      if (ok) {
        this.notifier.showUpload('PDF uploaded to the public RECAP Archive.', () => {});
      }
      ``;
    });
  } else {
    console.info('RECAP: Not uploading PDF. RECAP is disabled.');
  }
};
