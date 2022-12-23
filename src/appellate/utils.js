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
      clonedNode.setAttribute('data-pacer_doc_id', docId);
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

    if (docId){
      return `${docId.slice(0, 3)}0${docId.slice(4)}`;
    }    
  },

  // returns document data as an object
  parsePdfDataFromTitle: (title_string) => {
    // The title in the Download Confirmation page from Appellate pacer shows useful information about the document.
    // this title has the case number, document number and the attachment number (if the document belongs to an attachment
    // page). Here are some examples:
    //
    //  - Document: PDF Document (Case: 20-15019, Document: 11)
    //  - Document: PDF Document (Case: 20-15019, Document: 1-1) (document from attachment page)
    //
    // this method uses regex expressions to match that information from the title and returns an object with the following
    // attributes:
    //  - case_num
    //  - doc_num
    //  - att_num

    let dataFromAttachment = /^Document: PDF Document \(Case: ([^']*), Document: (\d)-(\d)\)/.exec(title_string);
    let dataFromSingleDoc = /^Document: PDF Document \(Case: ([^']*), Document: (\d+)\)/.exec(title_string);
    if (!dataFromAttachment && !dataFromSingleDoc) {
      return null;
    }
    let r = {};
    if (dataFromAttachment) {
      [, r.case_num, r.doc_num, r.att_num] = dataFromAttachment;
    } else {
      [, r.case_num, r.doc_num] = dataFromSingleDoc;
      r.att_num = 0;
    }
    return r;
  },

  // returns HTML to create a full page iframe that loads the url passed as an argument
  getFullPageIframe: (url) => {
    return `<style>body { margin: 0; padding: 0; height: 100%; overflow: hidden; } iframe { border: none; }</style> 
            <div class='appellate-full-page-iframe'>
            <iframe src="${url}" width="100%" height="100%" frameborder="0"></iframe>
            </div>`;
  },
};
