let APPELLATE = {
  // Returns URLSearchParams interface or empty object.
  getQueryParameters: () => {
    // Use the URLSearchParams interface to work with the query string of the URL.
    return new URLSearchParams(window.location.search);
  },

  // returns the servlet parameter from the inputs on the page
  getServletFromInputs: () => {
    // Appellate PACER uses the servlet parameter to identify pages. This parameter
    // can be usually found in the URL's query string but there's also a hidden input
    // on some pages that has the same name and value, so We can use it to identify
    // the page when the parameter is not present in the URL like in the Case Selection
    // page.
    let input = document.querySelector('input[name=servlet]');
    if (input) return input.value;
  },

  // tries to retrieve the pacer_case_id using different approaches:
  //
  //   - Check the URL's query string if its available
  //   - Check inputs on the page
  //   - Check collection of docId and caseId
  //   - Check the storage
  getCaseId: async (tabId, queryParameters, docId) => {
    let input = document.querySelector('input[name=caseId]');
    let pacer_case_id = queryParameters.get('caseid') || queryParameters.get('caseId') || (input && input.value);

    // try to get a mapping from a pacer_doc_id in the URL to the pacer_case_id
    if (!pacer_case_id && docId) {
      pacer_case_id = await getPacerCaseIdFromPacerDocId(tabId, docId);
    }

    // if the last step didn't find the caseId, It will check the storage
    if (!pacer_case_id) {
      const tabStorage = await getItemsFromStorage(tabId);
      if (!tabStorage && !tabStorage.caseId) {
        return;
      }
      pacer_case_id = tabStorage.caseId;
    }

    return pacer_case_id;
  },

  // Returns true if this is a "Attachment page"
  isAttachmentPage: () => {
    let form = document.querySelector("form[name='dktEntry']");
    return form !== null;
  },

  // Returns true if the URL is for the case selection page.
  isCaseSelectionPage: (url) => {
    // The URL for the selection page used in Appellate PACER is:
    //
    //    https://ecf.ca9.uscourts.gov/n/beam/servlet/TransportRoom
    //
    // but the URL for other pages has a Query string:
    //
    //   https://ecf.ca9.uscourts.gov/n/beam/servlet/TransportRoom?servlet=CaseSummary.jsp&caseNum=20-15019&incOrigDkt=Y&incDktEntries=Y
    //
    // This function checks if the URL has a query string and is related to Appellate PACER.
    // It will return true only when the url match the format of the first example and it will
    // exclude pages that include the TransportRoom word but has a query string like the last example.
    return /servlet\/TransportRoom/.test(url) && !/[?&]/.test(url);
  },

  // Returns true if the case selection page has one row.
  caseSelectionPageHasOneRow: () => {
    // The Case Selection Page from Appellate shows cases that match the user's search criteria defined 
    // on the Case Search page. This case selection can show multiple cases and has a few hidden inputs. 
    // The csnum1 and csnum2 are two of them. These hidden input fields are populated in the following cases:
    //
    // - When the Case Selection Page shows one case because the user used the Case Number/Range field 
    // to find a case by case number (csnum1 is populated, csnum2 is not populated).
    // - When the Case Selection Page shows one or more cases because the user used the Case Number/Range 
    // field to find cases within a range of case numbers (both inputs are populated)
    //
    // These inputs are not populated when the user have defined another criteria on the Case Search page and 
    // thus we will also use the number of case_ids on the page to check the number of cases listed on the page.

    let anchors = document.querySelectorAll('a[href*="caseid"]');

    let csnum1 = document.getElementsByName('csnum1')[0];
    let csnum2 = document.getElementsByName('csnum2')[0];

    return (csnum1.value && !csnum2.value) || anchors.length == 1;
  },

  // This method updates the href attribute of each Case Summary anchors.
  addCaseIdToDocketSummaryLink: () => {
    // This method extracts the pacer_case_id from each row on the Case Selection Page and appends it to
    // the docker report link as a URL parameters so the extension can retrieve if the users select the case. 
    // Each row in the Case selection page has the following links:
    //
    //  - Link to get the Docket Report Summary (This one does not have the pacer_case_id)
    //  - Link to get the Case Query (this one has the pacer_case_id as a URL parameter)
    //  - Link to get the Case Summary for Originating Case
    //
    // The extension is able to get the pacer_case_id and saves it to the tab storage when the Case Selection 
    // shows only a case but this approach is not possible when multiple cases are listed so this method allows 
    // us to support Case Selection pages with multiple cases.

    document.querySelectorAll('a[href*="caseid"]').forEach((caseQueryAnchor) => {
      let params = new URLSearchParams(caseQueryAnchor.href);
      let caseId = params.get('caseId') || params.get('caseid')
      // the Docket Report and the Case Query links are enclosed by the same HTML tag and the anchor for
      // the Docket Report is the first element inside this tag so using the parentElement and the firstChild
      // attribute allow us to get the desired HTML element.
      let caseSummaryAnchor = caseQueryAnchor.parentElement.firstChild;
      caseSummaryAnchor.setAttribute('href', `${caseSummaryAnchor.href}&caseId=${caseId}`);
    });
  },

  // Returns caseId from href attribute of Case Query link on the Case Selection Page.
  getCaseIdFromCaseSelection: () => {
    let table = document.querySelectorAll('table');

    if (table.length < 3) {
      console.info(
        'RECAP: no matching format was detected, the extension will take no action because the page does not have the minimum number of tables.'
      );
      return;
    }
    let anchor = table[3].querySelectorAll('tr > td > a');

    if (anchor.length < 3) {
      console.info(
        "RECAP: no matching format was detected. There aren't enough anchors in the table that the extension found."
      );
      return;
    }
    let queryString = anchor[1].href.split('?')[1];
    let queryParameters = new URLSearchParams(queryString);
    let caseId = queryParameters.get('caseid') || queryParameters.get('caseId');

    return caseId;
  },

  // Create a list of doc_ids from the list of all links available on the page
  findDocLinksFromAnchors: (nodeList) => {
    let links = [];
    let docsToCases = {};
    Array.from(nodeList).map((a) => {
      if (!PACER.isDocumentUrl(a.href)) return;

      let doDoc = PACER.parseDoDocPostURL(a.getAttribute('onclick'));
      if (doDoc && doDoc.doc_id && doDoc.case_id) {
        docsToCases[doDoc.doc_id] = doDoc.case_id;
      }

      a.removeAttribute('onclick');
      a.setAttribute('target', '_self');

      // clone and replace anchor elements to remove all listeners
      let clonedNode = a.cloneNode(true);
      a.replaceWith(clonedNode);

      // add a new listener that allows the anchors to target the active tab
      clonedNode.addEventListener('click', (event) => {
        let form = document.getElementsByName('doDocPostURLForm')[0];
        if (form) {
          form.dls_id.value = params.doc_id;
          form.caseId.value = params.case_id;
          form.submit();
        }
      });

      let docId = PACER.getDocumentIdFromUrl(a.href);
      links.push(docId);
    });
    return { links, docsToCases };
  },

  // get the docId from the servlet parameter of the attachment page or the single doc page
  getDocIdFromServlet: (servlet) => {
    if (!servlet) return;

    let docString = /^ShowDoc\/(\d+)/.exec(servlet);

    if (!docString) return;

    let [_, docId] = docString;

    return docId;
  },
};
