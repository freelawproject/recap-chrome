//  Abstraction of scripts related to Appellate PACER to make them modular and testable.
let AppellateDelegate = function (tabId, court, url, links) {
  this.tabId = tabId;
  this.court = court;
  this.url = url;
  this.links = links || [];
  this.recap = importInstance(Recap);
  this.notifier = importInstance(Notifier);
};

// Identify the current page using the URL and the query string,
// then dispatch the associated handler
AppellateDelegate.prototype.dispatchPageHandler = function () {
  this.queryParameters = APPELLATE.getQueryParameters(this.url);
  let targetPage = this.queryParameters.get('servlet');
  switch (targetPage) {
    case 'CaseSummary.jsp':
      this.handleDocketDisplayPage();
      break;
    default:
      if (APPELLATE.isCaseSelectionPage(this.url)) {
        this.handleCaseSelectionPage();
      } else {
        console.info('No identified appellate page found');
      }
      break;
  }
};

AppellateDelegate.prototype.handleCaseSelectionPage = async function () {
  // retrieve pacer_case_id from the link related to the Case Query
  let pacer_case_id = APPELLATE.getCaseIdFromCaseSelection();
  await saveCaseIdinTabStorage({ tabId: this.tabId }, pacer_case_id);
};

// check every link in the document to see if RECAP has it
AppellateDelegate.prototype.attachRecapLinksToEligibleDocs = async function () {
  // filter the links for the documents available on the page
  const links = APPELLATE.findDocLinksFromAnchors(this.links);

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
          class: 'recap-inline',
          title: 'Available for free from the RECAP Archive.',
          href: href,
        });
        recap_link.append(
          $('<img/>').attr({
            src: chrome.extension.getURL('assets/images/icon-16.png'),
          })
        );
        recap_link.insertAfter(this.links[i]);
      }
      let spinner = document.getElementById('recap-button-spinner');
      if (spinner) {
        spinner.classList.add('recap-btn-spinner-hidden');
      }
    }, this)
  );
};

AppellateDelegate.prototype.handleDocketDisplayPage = async function () {
  // retrieve pacer_case_id from URL query parameters
  let pacer_case_id = this.queryParameters.get('caseid') || this.queryParameters.get('caseId');

  // if the last step didn't find the caseId in the query parameter, It will check the storage
  if (!pacer_case_id) {
    const tabStorage = await getItemsFromStorage(this.tabId);
    if (!tabStorage && !tabStorage.caseId) {
      return;
    }
    pacer_case_id = tabStorage.caseId;
  }

  // Query the first table with case data and insert the RECAP actions button
  let table = document.querySelectorAll('table')[3];
  let button = recapActionsButton(this.court, pacer_case_id, false);
  table.after(button);

  this.recap.getAvailabilityForDocket(this.court, pacer_case_id, (result) => {
    if (result.count === 0) {
      console.warn('RECAP: Zero results found for docket lookup.');
    } else if (result.count > 1) {
      console.error(`RECAP: More than one result found for docket lookup. Found ${result.count}`);
    } else {
      addAlertButtonInRecapAction(this.court, pacer_case_id);
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
        addAlertButtonInRecapAction(this.court, pacer_case_id);
        history.replaceState({ uploaded: true }, '');
        this.notifier.showUpload('Docket uploaded to the public RECAP Archive.', function () {});
      }
    };

    this.recap.uploadDocket(this.court, pacer_case_id, document.documentElement.innerHTML, 'APPELLATE_DOCKET', (ok) =>
      callback(ok)
    );

    this.attachRecapLinksToEligibleDocs();
  } else {
    console.info(`RECAP: Not uploading docket. RECAP is disabled.`);
  }
};