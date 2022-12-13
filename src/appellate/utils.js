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

  // returns the pacer_case_id from the inputs on the page
  getCaseIdFromInputs: () => {
    let input = document.querySelector('input[name=caseId]');
    if (input) return input.value;
  },

  // returns the pacer_case_id from the URL's query string if its available
  getCaseIdFromSearchQuery: (queryParameters) => {
    let pacer_case_id = queryParameters.get('caseid') || queryParameters.get('caseId');
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
    const links = [];
    Array.from(nodeList).map((a) => {
      if (!PACER.isDocumentUrl(a.href)) return;

      // this regex will match the doc_id and case_id passed as an argument in the
      // onclick event of each anchor element related to a document
      let doDocPost = /^return doDocPostURL\('([^']*)','([^']*)'\);/.exec(a.getAttribute('onclick'));
      let params = {};
      if (doDocPost) {
        [, params.doc_id, params.case_id] = doDocPost;
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
    return links;
  },

  // Create dummy iframe to use as a target for the forms on different pages
  createDummyIframe: (name) => {
    // A few pages from Appellate PACER use a hidden form that is submitted when an
    // anchor link is clicked. This hidden form has its target attribute set to open
    // a new tab, so We're using this iframe to change the target of the hidden form
    // and avoid opening multiple tabs for the same PACER case.
    let iframe = document.createElement('iframe');
    iframe.setAttribute('name', name);
    iframe.setAttribute('id', name);
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
  },
};
