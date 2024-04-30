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
  getCaseId: async (tabId, queryParameters, docId, docketNumber = null) => {
    let input = document.querySelector('input[name=caseId]');
    let pacer_case_id = queryParameters.get('caseid') || queryParameters.get('caseId') || (input && input.value);

    // try to get a mapping from a pacer_doc_id in the URL to the pacer_case_id
    if (!pacer_case_id && docId) {
      pacer_case_id = await getPacerCaseIdFromPacerDocId(tabId, docId);
    }

    // if the last step didn't find the caseId, It will check the storage
    if (!pacer_case_id) {
      const tabStorage = await getItemsFromStorage(tabId);
      if (!tabStorage) {
        return;
      }

      if (!('docketNumber' in tabStorage) || !('caseId' in tabStorage)) {
        return;
      }

      if (docketNumber == tabStorage.docketNumber) {
        pacer_case_id = tabStorage.caseId;
      }
    }

    return pacer_case_id;
  },

  // Tries to retrieve the docket number using different approches
  //
  //   - Check the URL's query string if its available
  //   - Check inputs on the page
  getDocketNumber: (queryParameters) => {
    let caseNumInput = document.querySelector('input[name=caseNum]');
    let csNum1Input = document.querySelector('input[name=csnum1]');
    let docketNumber =
      queryParameters.get('casenum') ||
      queryParameters.get('caseNum') ||
      (csNum1Input && csNum1Input.value) ||
      (caseNumInput && caseNumInput.value) ||
      queryParameters.get('recapCaseNum');

    return docketNumber;
  },

  // Returns true if this is a "Attachment page"
  isAttachmentPage: () => {
    let form = document.querySelector("form[name='dktEntry']");
    if (form !== null)
      return true;
    let table = document.getElementsByTagName("table");
    let header = table.length ? table[0].getElementsByTagName("th") : false;
    return (header && header.length) ? header[0].textContent.includes('Documents are attached to this filing') : false;
  },

  // Returns true if this is a "Download Confirmation page"
  isSingleDocumentPage: () => {
    let form = document.querySelector("form[name='AccCharge']");
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
    // The HTML structure of a row is the following:
    //
    //  <tr>
    //    <td>
    //      <a href='TransportRoom?servlet=CaseSummary.jsp&amp;caseNum=20-15021'>
    //        20-15021
    //      </a>
    //      <a href='TransportRoom?servlet=CaseQuery.jsp&caseid=318557&csnum1=20-15021'>
    //        Edward Ray, Jr. v. A. Ribera, et al
    //      </a>
    //    </td>
    //    ...
    //    <td>
    //      <a href='https://ecf.caed.uscourts.gov/cgi-bin/DktRpt.pl?caseNumber=1:19-cv-01561-AWI-SKO'>
    //        1:19-cv-01561-AWI-SKO
    //      </a>
    //    </td>
    //  </tr>
    //
    // The extension is able to get the pacer_case_id and saves it to the tab storage when the Case Selection
    // shows only a case but this approach is not possible when multiple cases are listed so this method allows
    // us to support Case Selection pages with multiple cases.

    document.querySelectorAll('a[href*="caseid"]').forEach((caseQueryAnchor) => {
      let queryUrl = new URL(caseQueryAnchor.href, window.location);
      let queryParams = queryUrl.searchParams;
      let caseId = queryParams.get('caseId') || queryParams.get('caseid');
      // the Docket Report and the Case Query links are enclosed by the same HTML tag and the anchor for
      // the Docket Report is the first element inside this tag so using the parentElement and the firstChild
      // attribute allow us to get the desired HTML element.
      let caseSummaryAnchor = caseQueryAnchor.parentElement.firstChild;
      // This has the side effect of making this URL absolute, when it may have started out relative.
      let summaryUrl = new URL(caseSummaryAnchor.href, window.location);
      summaryUrl.searchParams.set('caseId', caseId);
      caseSummaryAnchor.setAttribute('href', summaryUrl);
      caseSummaryAnchor.dataset.recap = 'Modified by RECAP Extension to add caseId attribute.';
      caseSummaryAnchor.classList.add('recap_modified');
    });
  },

  getTableWithDataFromCaseSelection: () => {
    // Pages in Appellate PACER use three tables to align items in the headers (one for items on
    // the right side, one for items on the left side, and one table to wrap the previous ones), so
    // the 4th table is the one that lists all the cases that match the user's search criteria.
    //
    // This method uses the querySelectorAll method to get all the tables on the page and find the
    // one with data.

    let table = document.querySelectorAll('table');

    if (table.length < 3) {
      console.info(
        'RECAP: no matching format was detected, the extension will take no action because the page does not have the minimum number of tables.'
      );
      return;
    }
    return table[3];
  },

  // Returns caseId from href attribute of Case Query link on the Case Selection Page.
  getCaseIdFromCaseSelection: function () {
    let dataTable = this.getTableWithDataFromCaseSelection();
    if (!dataTable) return;

    let anchor = dataTable.querySelectorAll('a');

    if (anchor.length < 2) {
      console.info(
        "RECAP: no matching format was detected. There aren't enough anchors in the table that the extension found."
      );
      return;
    }

    let url = new URL(anchor[1].href, window.location);
    let queryParameters = url.searchParams;
    let caseId = queryParameters.get('caseid') || queryParameters.get('caseId');

    return caseId;
  },

  onClickEventHandlerForDocLinks: function (e) {
    let target = e.currentTarget || e.srcElement;
    let params = {
      dls_id: target.dataset.pacerDlsId,
      caseId: target.dataset.pacerCaseId,
      servlet: 'ShowDoc',
      dktType: 'dktPublic',
    };
    let query_string = new URLSearchParams(params).toString();
    httpRequest(
      'TransportRoom',
      query_string,
      'application/x-www-form-urlencoded',
      function (type, ab, xhr) {
        let requestHandler = handleFreeDocResponse.bind(this);
        requestHandler(type, ab, xhr);
      }.bind(target)
    );
  },

  // Create a list of doc_ids from the list of all links available on the page
  findDocLinksFromAnchors: function (nodeList, tabId, queryParameters, docketNumber) {
    let links = [];
    let docsToCases = {};
    Array.from(nodeList).map((a) => {
      if (!PACER.isDoc1Url(a.href)) return;

      let docNum = PACER.getDocNumberFromAnchor(a) || queryParameters.get('recapDocNum');
      let doDoc = PACER.parseDoDocPostURL(a.getAttribute('onclick'));
      if (doDoc && doDoc.doc_id && doDoc.case_id) {
        docsToCases[doDoc.doc_id] = doDoc.case_id;
      }

      a.removeAttribute('onclick');
      a.setAttribute('target', '_self');

      let url = new URL(a.href);
      let pacerCaseId = (doDoc && doDoc.case_id) || queryParameters.get('caseId');
      url.searchParams.set('caseId', pacerCaseId);

      if (docNum) {
        url.searchParams.set('recapDocNum', docNum);
      }

      if (docketNumber) {
        url.searchParams.set('recapCaseNum', docketNumber);
      }

      // if an attachment number is found, it adds it to the link href
      let attNumber = PACER.getAttachmentNumberFromAnchor(a);
      if (attNumber != 0) {
        url.searchParams.set('recapAttNum', attNumber);
      }

      a.setAttribute('href', url.toString());

      // clone and replace anchor elements to remove all listeners
      let clonedNode = a.cloneNode(true);
      a.replaceWith(clonedNode);

      // add a new listener that allows us to request the document data to PACER
      // and check the response content-type.
      clonedNode.onclick = function (e) {
        document.body.style.cursor = 'wait';
        this.onClickEventHandlerForDocLinks(e);
        return false;
      }.bind(this);

      // store extra information on anchors to use it while handling the onClick listener
      let docId = PACER.getDocumentIdFromUrl(clonedNode.href);

      clonedNode.dataset.pacerDocId = docId;
      if (doDoc && doDoc.doc_id) {
        // don't normalize this attribute because we use it to check whether a doc is free or not
        clonedNode.dataset.pacerDlsId = doDoc.doc_id;
      }
      clonedNode.dataset.pacerCaseId = pacerCaseId;
      clonedNode.dataset.pacerTabId = tabId;
      clonedNode.dataset.documentNumber = docNum ? docNum : docId;
      clonedNode.dataset.attachmentNumber = attNumber;

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

    if (docId) {
      return PACER.cleanPacerDocId(docId);
    }
  },

  // get the docId from the URL of the attachment page or the single doc page
  getDocIdFromURL: function (queryParameters) {
    // this method retrieves the document id using different approaches:
    //
    //   - checks the dls_id parameter in the given query string
    //   - checks the servlet parameter in the query string
    //
    // in cases where both dls_id is specified AND there is a pathname appended to the
    // ShowDoc servlet, the dls_id takes precedence. E.g.
    //
    //   - if queryParameters is ?servlet=ShowDoc/009032127512&dls_id=009032292595, this
    //   method returns 009032292595.
    //   - if queryParameters is ?servlet=ShowDoc/009032127512&caseId=325867, this method
    //   returns 009032127512
    //   - if queryParameters is ?servlet=ShowDoc&dls_id=009032127512, this method returns
    //   009032127512
    return queryParameters.get('dls_id') || this.getDocIdFromServlet(queryParameters.get('servlet'));
  },

  // returns data from the title of the Receipt Page as an object
  parseReceiptPageTitle: (title_string) => {
    // The title in the Download Confirmation page from Appellate pacer shows
    // useful information about the document. This title has the docket number,
    // document number and the attachment number (if the document belongs to an
    // attachment page). Here are some examples:
    //
    //  - Document: PDF Document (Case: 20-15019, Document: 11)
    //  - Document: PDF Document (Case: 20-15019, Document: 1-1) (document
    //    from attachment page)
    //  - Document: PDF Document (Case: 20-15019, Document: 1.1) (document
    //    from ACMS)
    //
    // this method uses regex expressions to match that information from the
    // title and returns an object with the following attributes:
    //  - docket_number
    //  - doc_number
    //  - att_number

    let dataFromAttachment =
      /^Document: PDF Document \(Case: ([^']*), Document: (\d+)[-.]+(\d+)\)/.exec(
        title_string
      );
    let dataFromSingleDoc =
      /^Document: PDF Document \(Case: ([^']*), Document: (\d+)\)/.exec(
        title_string
      );

    if (!dataFromAttachment && !dataFromSingleDoc) {
      return null;
    }
    let r = {};
    if (dataFromAttachment) {
      [, r.docket_number, r.doc_number, r.att_number] = dataFromAttachment;
    } else {
      [, r.docket_number, r.doc_number] = dataFromSingleDoc;
      r.att_number = 0;
    }
    return r;
  },

  // Returns an object with the court Id and docket number core extracted from a link to district court
  getDatafromDistrictLinkUrl: (url) => {
    // Converts links to district courts like:
    //
    //   https://ecf.dcd.uscourts.gov/cgi-bin/iquery.pl?caseNumber=1:16-cv-00745-ESH
    //
    // into:
    //
    // {
    //   court: 'dcd',
    //   docket_number_core: 1600745
    // }

    let court = PACER.getCourtFromUrl(url);

    let queryString = url.split('?')[1];
    let queryParameters = new URLSearchParams(queryString);
    let docketNumber = queryParameters.get('caseNumber') || queryParameters.get('casenumber');

    if (docketNumber) {
      docketNumber = PACER.makeDocketNumberCore(docketNumber);
    }

    return {
      court: court,
      docket_number_core: docketNumber,
    };
  },

  // returns div element that contains an anchor with the RECAP icon
  makeRButtonForCases: (url) => {
    let href = `https://www.courtlistener.com${url}`;
    let recap_link = $('<a/>', {
      title: 'Docket is available for free in the RECAP Archive.',
      href: href,
      target: '_blank',
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

    return recap_div;
  },

  // Adds the vue data attributes to the session storage
  storeVueDataInSession: () => {
    var code =
      '(' +
      function () {
        let contentWrapper = document.getElementsByClassName('text-center')[0];
        let vueMainDiv = contentWrapper.parentElement;
        let vueDataProperties = vueMainDiv.__vue__._data;
        sessionStorage.setItem(
          'recapVueData',
          JSON.stringify(vueDataProperties)
        );
        sessionStorage.setItem(
          'recapACMSConfiguration',
          JSON.stringify(window._model)
        );
      } +
      ')();';

    let script = document.createElement('script');
    script.textContent = code;
    document.head.appendChild(script);

    // We just need this script once and the inline script that's inserted in
    // the document is immediately executed. Therefore, it's safe to remove
    // this tag.
    script.remove();
  },
};
