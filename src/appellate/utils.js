let APPELLATE = {

  getQueryParameters: (url) => {
    let re = /(?:TransportRoom)\?((&?[\w]+=[^&=\n]+)+)/;
    let queryParameters = url.match(re);
    if (!!queryParameters) return new URLSearchParams(queryParameters[1])
    return {}
  },

  isCaseSelectionPage: (url) => {
    return /servlet\/TransportRoom/.test(url) && !/[?&]/.test(url)
  },

  getCaseIdFromCaseSelection: () =>{
    let table = document.querySelectorAll('table')[3]
    let anchor = table.querySelectorAll('tr > td > a')
    let queryString = anchor[1].href.split('?')[1]
    let queryParameters = new URLSearchParams(queryString)
    let caseId = queryParameters.get('caseid') || queryParameters.get('caseId')

    return caseId
  },

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