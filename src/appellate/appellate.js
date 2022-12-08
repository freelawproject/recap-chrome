//  Abstraction of scripts related to Appellate PACER to make them modular and testable.
let AppellateDelegate = function (tabId, court, url, links) {
  this.tabId = tabId;
  this.court = court;
  this.url = url
  this.links = links || []
  this.recap = importInstance(Recap);
};


AppellateDelegate.prototype.dispatchPageHandler = function () {
  if (APPELLATE.isCaseSelectionPage(this.url)) {
    this.handleCaseSelectionPage()
  } else {
    
    let queryParameters = APPELLATE.getQueryParameters(this.url);    
    if (!(queryParameters instanceof URLSearchParams)) {
      return;
    }
    
    let targetPage = queryParameters.get('servlet');
    switch (targetPage) {
      case 'CaseSummary.jsp':
        this.handleDocketDisplayPage()
        break;
      default:
        console.info('No identified appellate page found');
        break
    }
  }

};

AppellateDelegate.prototype.handleCaseSelectionPage = async function () {
  let pacer_case_id = APPELLATE.getCaseIdFromCaseSelection()
  await saveCaseIdinTabStorage({ tabId: this.tabId }, pacer_case_id)
}

// check every link in the document to see if RECAP has it
AppellateDelegate.prototype.attachRecapLinksToEligibleDocs= async function () {
  // get links
  const links = APPELLATE.findDocLinksFromAnchors(this.links);

  let linkCount = links.length;
  console.info(`RECAP: Attaching links to all eligible documents (${linkCount} found)`);
  if (linkCount === 0) {
    return;
  }

   // Ask the server whether any of these documents are available from RECAP.
  this.recap.getAvailabilityForDocuments(links, this.court,
    $.proxy(function (api_results) {
      console.info(`RECAP: Got results from API. Running callback on API results to ` +
        `attach links and icons where appropriate.`);
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
          'class': 'recap-inline',
          'title': 'Available for free from the RECAP Archive.',
          'href': href
        });
        recap_link.append($('<img/>').attr({
          src: chrome.extension.getURL('assets/images/icon-16.png')
        }));
        recap_link.insertAfter(this.links[i]);
      }
      let spinner = document.getElementById("recap-button-spinner")
      if (spinner){
          spinner.classList.add('recap-btn-spinner-hidden');
      }
    }, this));
}


AppellateDelegate.prototype.handleDocketDisplayPage = async function () {
 
  const tabStorage = await getItemsFromStorage(this.tabId)
  let pacer_case_id = tabStorage.caseId;

  let table = document.querySelectorAll('table')[3]
  let button = recapActionsButton(this.court, pacer_case_id, false)
  table.after(button)

  this.recap.getAvailabilityForDocket(
    this.court,
    pacer_case_id,
    (result) => {
      if (result.count === 0) {
        console.warn('RECAP: Zero results found for docket lookup.');
      } else if (result.count > 1) {
        console.error(
          `RECAP: More than one result found for docket lookup. Found ${result.count}`
        );
      } else {
        addAlertButtonInRecapAction(this.court, pacer_case_id)
        let cl_id = getClIdFromAbsoluteURL(result.results[0].absolute_url)
        addSearchDocketInRecapAction(cl_id)
      }
    }
  );

  this.attachRecapLinksToEligibleDocs()

  // if you've already uploaded the page, return
  if (history.state && history.state.uploaded) { return; }

}












