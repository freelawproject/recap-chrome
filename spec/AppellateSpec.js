describe('The Appellate module', function () {

  const nonQueryStringUrl = 'https://ecf.ca9.uscourts.gov/n/beam/servlet/TransportRoom';
  const caseSummaryPage = 'https://ecf.ca9.uscourts.gov/n/beam/servlet/TransportRoom?servlet=CaseSummary.jsp&caseNum=20-15019'
  const noDocumentLinks = [
    'TransportRoom?servlet=CaseSearch.jsp',
    'http://www.ca9.uscourts.gov/calendar/',
    'http://www.ca9.uscourts.gov/opinions/'
  ]
  const documentLinks = [
    'https://ecf.ca9.uscourts.gov/docs1/009031927529',
    'https://ecf.ca9.uscourts.gov/docs1/009031956734'
  ]

  function clearBody() {
    document.body.innerHTML=''
  }

  describe('getQueryParameters', function () {
    it('returns empty object for URL that does not have query string', function () {
      expect(APPELLATE.getQueryParameters(nonQueryStringUrl)).toEqual({});
    });

    it('returns URLSearchParams interface for URL that does have query string', function () {
      expect(APPELLATE.getQueryParameters(caseSummaryPage)).toBeInstanceOf(URLSearchParams);
    });
  })

  describe('isCaseSelectionPage', function () {
    it('returns true for URLs that does not have query string', function () {
      expect(APPELLATE.isCaseSelectionPage(nonQueryStringUrl)).toBe(true);
    });

    it('returns false for URLs that does have query string', function () {
      expect(APPELLATE.isCaseSelectionPage(caseSummaryPage)).toBe(false);
    })
  })

  describe('findDocLinksFromAnchors', function () {
    it('returns empty array for empty input', function () {
      let doc_id = APPELLATE.findDocLinksFromAnchors([])
      expect(doc_id.length).toBe(0);
    })

    describe('for documents with links', function () {

      describe('not related to documents', function () {

        beforeEach(function () {
          let noDocLinksDiv = document.createElement('div')
          noDocLinksDiv.setAttribute('id', 'no_links')
          noDocumentLinks.forEach(function (item, index) {
            let anchor = document.createElement('a')
            anchor.href = item
            noDocLinksDiv.appendChild(anchor)
          });

          document.body.appendChild(noDocLinksDiv)
        });

        afterEach(function () {
          clearBody()
        })

        it('returns empty array', function () {
          let anchors = document.querySelectorAll('#no_links > a')
          let doc_id = APPELLATE.findDocLinksFromAnchors(anchors)
          expect(doc_id.length).toBe(0);
        })
      })

      describe('related to documents', function () {

        beforeEach(function () {
          let docLinksDiv = document.createElement('div')
          docLinksDiv.setAttribute('id', 'links')
          documentLinks.forEach(function (item, index) {
            let anchor = document.createElement('a')
            anchor.href = item
            anchor.title = 'Open Document'
            docLinksDiv.appendChild(anchor)
          });
          document.body.appendChild(docLinksDiv)
        })

        afterEach(function () {
          clearBody()
        })

        it('returns array with doc_ids', function () {
          let anchors = document.querySelectorAll('#links > a')
          let doc_id = APPELLATE.findDocLinksFromAnchors(anchors)
          expect(doc_id.length).toBe(2);
          expect(doc_id).toEqual(['009031927529', '009031956734'])
        })

      })
    })
  })

  describe ('getCaseIdFromCaseSelection', function(){

    describe('for documents which have non-matching format', function(){
      it('returns undefined', function () {
        expect(APPELLATE.getCaseIdFromCaseSelection()).toBeUndefined();
      });
    })

    describe('for documents which have less table elements', function(){
      beforeEach(function () {
        let uniqueTable = document.createElement('table')
        document.body.appendChild(uniqueTable)
      })

      afterEach(function () {
        clearBody()
      })


      it('returns undefined', function () {
        expect(APPELLATE.getCaseIdFromCaseSelection()).toBeUndefined();
      });
    })
    
    describe('for documents which have the right amount of table elements but no anchors', function(){
      beforeEach(function () {
        let rightPositionNav = document.createElement('table')
        let leftPositionNav = document.createElement('table')
        let titleTable = document.createElement('table')
        let docketInformationTable = document.createElement('table')

        document.body.appendChild(rightPositionNav)
        document.body.appendChild(leftPositionNav)
        document.body.appendChild(titleTable)
        document.body.appendChild(docketInformationTable)
      })

      afterEach(function () {
        clearBody()
      })


      it('returns undefined', function () {
        expect(APPELLATE.getCaseIdFromCaseSelection()).toBeUndefined();
      });
    })

    describe('for documents with matching format', function(){
      beforeEach(function () {
        let rightPositionNav = document.createElement('table')
        let leftPositionNav = document.createElement('table')
        let titleTable = document.createElement('table')
        let docketInformationTable = document.createElement('table')

        let tbody = document.createElement('tbody')
        let tr  = document.createElement('tr')
        let td  = document.createElement('td')
        
        let caseSummaryAnchor = document.createElement('a')
        caseSummaryAnchor.href = 'TransportRoom?servlet=CaseSummary.jsp&caseNum=20-15019&incOrigDkt=Y&incDktEntries=Y'
        
        let caseQueryAnchor = document.createElement('a')
        caseQueryAnchor.href = 'TransportRoom?servlet=CaseQuery.jsp&cnthd=1537139545&caseid=318547&csnum1=20-15019&shorttitle=The+Bank+of+New+York+Mellon+v.+SFR+Investments+Pool+1%2C+LLC%2C+et+al'
 
        let originationCaseAnchor = document.createElement('a')
        originationCaseAnchor.href = 'https://ecf.nvd.uscourts.gov/cgi-bin/DktRpt.pl?caseNumber=2:16-cv-01129-RFB-DJA'

        td.appendChild(caseSummaryAnchor)
        td.appendChild(caseQueryAnchor)
        td.appendChild(originationCaseAnchor)

        tr.appendChild(td)
        tbody.appendChild(tr)
        docketInformationTable.appendChild(tbody)

        document.body.appendChild(rightPositionNav)
        document.body.appendChild(leftPositionNav)
        document.body.appendChild(titleTable)
        document.body.appendChild(docketInformationTable)
      })

      afterEach(function () {
        clearBody()
      })

      it('returns the caseId', function () {
        expect(APPELLATE.getCaseIdFromCaseSelection()).toBe('318547');
      });

    })
  })
})