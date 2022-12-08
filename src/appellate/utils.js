let APPELLATE = {

  // Returns URLSearchParams interface or empty object.
  getQueryParameters: (url) => {
    // Use regex expression to get the query string from the page URL 
    let re = /(?:TransportRoom)\?((&?[\w]+=[^&=\n]+)+)/;
    let queryParameters = url.match(re);
    // Use the URLSearchParams interface to work with the query string of the URL.
    if (!!queryParameters) return new URLSearchParams(queryParameters[1])
    return {}
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
    return /servlet\/TransportRoom/.test(url) && !/[?&]/.test(url)
  },

  // Returns caseId from href attribute of Case Query link on the Case Selection Page.
  getCaseIdFromCaseSelection: () =>{
    let table = document.querySelectorAll('table')[3]
    let anchor = table.querySelectorAll('tr > td > a')
    let queryString = anchor[1].href.split('?')[1]
    let queryParameters = new URLSearchParams(queryString)
    let caseId = queryParameters.get('caseid') || queryParameters.get('caseId')

    return caseId
  },

  // Create a list of doc_ids from the list of all links available on the page 
  findDocLinksFromAnchors: (nodeList) => {
    const links = [];
    Array.from(nodeList).map((a) => {
      if (a.title !== 'Open Document') return;
      let docId = PACER.getDocumentIdFromUrl(a.href);
      links.push(docId);
    });
    return links;
  },
  
}