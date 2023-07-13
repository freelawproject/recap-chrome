describe('The Appellate module', function () {
  const nonQueryStringUrl = 'https://ecf.ca9.uscourts.gov/n/beam/servlet/TransportRoom';
  const caseSummaryPage =
    'https://ecf.ca9.uscourts.gov/n/beam/servlet/TransportRoom?servlet=CaseSummary.jsp&caseNum=20-15019';
  const noDocumentLinks = [
    'TransportRoom?servlet=CaseSearch.jsp',
    'http://www.ca9.uscourts.gov/calendar/',
    'http://www.ca9.uscourts.gov/opinions/',
  ];
  const documentLinks = [
    {
      href: 'https://ecf.ca9.uscourts.gov/docs1/009031927529',
      onClick: "return doDocPostURL('009031927529','290338');",
      dlsId: '009031927529',
    },
    {
      href: 'https://ecf.ca9.uscourts.gov/docs1/009131956734',
      onClick: "return doDocPostURL('009131956734','290338');",
      dlsId: '009131956734',
    },
  ];
  const searchParamsWithCaseId = new URLSearchParams('servlet=DocketReportFilter.jsp&caseId=318547');
  const searchParamsWithoutCaseId = new URLSearchParams('servlet=DocketReportFilter.jsp');

  const showDocURLs = [
    {
      url: '?servlet=ShowDoc/009032127512&dls_id=009032292595',
      docId: '009032292595',
    },
    {
      url: '?servlet=ShowDoc/009032292595&dls_id=009032127512',
      docId: '009032127512',
    },
    {
      url: '?servlet=ShowDoc&pacer=i&caseId=325867&dls_id=009033761377',
      docId: '009033761377',
    },
    { url: '?servlet=ShowDoc/009032145815&caseId=325867', docId: '009032145815' },
  ];

  function clearBody() {
    document.body.innerHTML = '';
  }

  describe('getQueryParameters', function () {
    it('returns URLSearchParams interface', function () {
      expect(APPELLATE.getQueryParameters(nonQueryStringUrl)).toBeInstanceOf(URLSearchParams);
      expect(APPELLATE.getQueryParameters(caseSummaryPage)).toBeInstanceOf(URLSearchParams);
    });
  });

  describe('getDocIdFromURL', function () {
    it('returns the document id ', function () {
      for (const item of showDocURLs) {
        var queryString = new URLSearchParams(item.url);
        expect(APPELLATE.getDocIdFromURL(queryString)).toBe(item.docId);
      }
    });
  });

  describe('getServletFromInputs', function () {
    describe('for pages with matching format', function () {
      beforeEach(function () {
        clearBody();
        let input = document.createElement('input');
        input.setAttribute('name', 'servlet');
        input.setAttribute('value', 'CaseSelectionTable.jsp');
        document.body.appendChild(input);
        document.querySelector = jasmine.createSpy('querySelector').and.callFake((query) => {
          return document.querySelectorAll(query).length ? document.querySelectorAll(query)[0] : null;
        });
      });

      it('returns the servlet parameter', function () {
        expect(APPELLATE.getServletFromInputs()).toBe('CaseSelectionTable.jsp');
      });
    });

    describe('for pages with non-matching format', function () {
      beforeEach(function () {
        clearBody();
      });

      it('returns undefined', function () {
        expect(APPELLATE.getServletFromInputs()).toBeUndefined();
      });
    });
  });

  describe('getCaseId', function () {
    describe('for pages with inputs', function () {
      beforeEach(function () {
        clearBody();
        let input = document.createElement('input');
        input.setAttribute('name', 'caseId');
        input.setAttribute('value', '318457');
        document.body.appendChild(input);
        document.querySelector = jasmine.createSpy('querySelector').and.callFake((query) => {
          return document.querySelectorAll(query).length ? document.querySelectorAll(query)[0] : null;
        });
      });

      it('returns the caseId value', async function () {
        expect(await APPELLATE.getCaseId('1234', searchParamsWithoutCaseId)).toBe('318457');
      });
    });

    describe('for pages with non-matching format', function () {
      beforeEach(function () {
        clearBody();
        window.chrome = {
          storage: {
            local: {
              get: jasmine.createSpy().and.callFake(function (_, cb) {
                cb({
                  [1234]: {},
                  options: { recap_enabled: true },
                });
              }),
            },
          },
        };
      });

      it('returns undefined', async function () {
        expect(await APPELLATE.getCaseId('1234', searchParamsWithoutCaseId)).toBeUndefined();
      });
    });
  });

  describe('isAttachmentPage', function () {
    describe('for pages with matching format', function () {
      beforeEach(function () {
        clearBody();
        let form = document.createElement('form');
        form.setAttribute('name', 'dktEntry');
        document.body.appendChild(form);
        document.querySelector = jasmine.createSpy('querySelector').and.callFake((query) => {
          return document.querySelectorAll(query).length ? document.querySelectorAll(query)[0] : null;
        });
      });

      it('returns true', function () {
        expect(APPELLATE.isAttachmentPage()).toBe(true);
      });
    });

    describe('for pages with non-matching format', function () {
      beforeEach(function () {
        clearBody();
        document.querySelector = jasmine.createSpy('querySelector').and.callFake((query) => {
          return document.querySelectorAll(query).length ? document.querySelectorAll(query)[0] : null;
        });
      });

      it('returns false', function () {
        expect(APPELLATE.isAttachmentPage()).toBe(false);
      });
    });
  });

  describe('isCaseSelectionPage', function () {
    it('returns true for URLs that does not have query string', function () {
      expect(APPELLATE.isCaseSelectionPage(nonQueryStringUrl)).toBe(true);
    });

    it('returns false for URLs that does have query string', function () {
      expect(APPELLATE.isCaseSelectionPage(caseSummaryPage)).toBe(false);
    });
  });

  describe('findDocLinksFromAnchors', function () {
    it('returns empty array for empty input', function () {
      let { links } = APPELLATE.findDocLinksFromAnchors([], '3', new URLSearchParams('docNum=30'));
      expect(links.length).toBe(0);
    });

    describe('for documents with links', function () {
      describe('not related to documents', function () {
        beforeEach(function () {
          clearBody();
          let noDocLinksDiv = document.createElement('div');
          noDocLinksDiv.setAttribute('id', 'no_links');
          noDocumentLinks.forEach(function (item, index) {
            let anchor = document.createElement('a');
            anchor.href = item;
            noDocLinksDiv.appendChild(anchor);
          });

          document.body.appendChild(noDocLinksDiv);
        });

        afterEach(function () {
          clearBody();
        });

        it('returns empty array', function () {
          let anchors = document.querySelectorAll('#no_links > a');
          let { links, _ } = APPELLATE.findDocLinksFromAnchors(anchors, '3', new URLSearchParams('docNum=30'));
          expect(links.length).toBe(0);
        });
      });

      describe('related to documents', function () {
        beforeEach(function () {
          clearBody();
          let docLinksDiv = document.createElement('div');
          docLinksDiv.setAttribute('id', 'links');
          documentLinks.forEach(function (item, index) {
            let anchor = document.createElement('a');
            anchor.href = item['href'];
            anchor.setAttribute('onclick', item['onClick']);
            anchor.title = 'Open Document';
            docLinksDiv.appendChild(anchor);
          });
          document.body.appendChild(docLinksDiv);
        });

        afterEach(function () {
          clearBody();
        });

        it('returns array with doc_ids', function () {
          let anchors = document.getElementsByTagName('a');
          console.log(anchors);
          let { links, _ } = APPELLATE.findDocLinksFromAnchors(
            anchors,
            '3',
            new URLSearchParams({ recapDocNum: '30' }),
            '20-15019'
          );
          expect(links.length).toBe(2);
          expect(links).toEqual(['009031927529', '009031956734']);

          for (let i = 0; i < anchors.length; i++) {
            let item = anchors[i];
            expect(item.dataset.pacerDlsId).toBe(documentLinks[i]['dlsId']);
            expect(item.dataset.pacerCaseId).toBe('290338');
            expect(item.dataset.pacerTabId).toBe('3');
            expect(item.dataset.attachmentNumber).toBe('0');
          }
        });
      });
    });
  });

  describe('getCaseIdFromCaseSelection', function () {
    beforeEach(function () {
      document.getElementById = jasmine
        .createSpy('getElementById')
        .and.callFake((id) => document.querySelectorAll(`#${id}`)[0]);
    });

    describe('for documents which have non-matching format', function () {
      it('returns undefined', function () {
        expect(APPELLATE.getCaseIdFromCaseSelection()).toBeUndefined();
      });
    });

    describe('for documents which have less table elements', function () {
      beforeEach(function () {
        clearBody();
        let uniqueTable = document.createElement('table');
        document.body.appendChild(uniqueTable);
      });

      afterEach(function () {
        clearBody();
      });

      it('returns undefined', function () {
        expect(APPELLATE.getCaseIdFromCaseSelection()).toBeUndefined();
      });
    });

    describe('for documents which have the right amount of table elements but no anchors', function () {
      beforeEach(function () {
        clearBody();
        let rightPositionNav = document.createElement('table');
        let leftPositionNav = document.createElement('table');
        let titleTable = document.createElement('table');
        let docketInformationTable = document.createElement('table');

        document.body.appendChild(rightPositionNav);
        document.body.appendChild(leftPositionNav);
        document.body.appendChild(titleTable);
        document.body.appendChild(docketInformationTable);
      });

      afterEach(function () {
        clearBody();
      });

      it('returns undefined', function () {
        expect(APPELLATE.getCaseIdFromCaseSelection()).toBeUndefined();
      });
    });

    describe('for documents with matching format', function () {
      beforeEach(function () {
        clearBody();
        let rightPositionNav = document.createElement('table');
        let leftPositionNav = document.createElement('table');
        let titleTable = document.createElement('table');
        let docketInformationTable = document.createElement('table');

        let tbody = document.createElement('tbody');
        let tr = document.createElement('tr');
        let td = document.createElement('td');

        let caseSummaryAnchor = document.createElement('a');
        caseSummaryAnchor.href = 'TransportRoom?servlet=CaseSummary.jsp&caseNum=20-15019&incOrigDkt=Y&incDktEntries=Y';

        let caseQueryAnchor = document.createElement('a');
        caseQueryAnchor.href =
          'TransportRoom?servlet=CaseQuery.jsp&cnthd=1537139545&caseid=318547&csnum1=20-15019&shorttitle=The+Bank+of+New+York+Mellon+v.+SFR+Investments+Pool+1%2C+LLC%2C+et+al';

        let originationCaseAnchor = document.createElement('a');
        originationCaseAnchor.href = 'https://ecf.nvd.uscourts.gov/cgi-bin/DktRpt.pl?caseNumber=2:16-cv-01129-RFB-DJA';

        td.appendChild(caseSummaryAnchor);
        td.appendChild(caseQueryAnchor);
        td.appendChild(originationCaseAnchor);

        tr.appendChild(td);
        tbody.appendChild(tr);
        docketInformationTable.appendChild(tbody);

        document.body.appendChild(rightPositionNav);
        document.body.appendChild(leftPositionNav);
        document.body.appendChild(titleTable);
        document.body.appendChild(docketInformationTable);
      });

      afterEach(function () {
        clearBody();
      });

      it('returns the caseId', function () {
        expect(APPELLATE.getCaseIdFromCaseSelection()).toBe('318547');
      });
    });
  });
});
