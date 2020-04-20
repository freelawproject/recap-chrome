/*global jasmine, DEBUGLEVEL */
describe('The ContentDelegate class', function () {
  // 'tabId' values
  const tabId = 1234;

  // 'path' values
  const districtCourtURI = 'https://ecf.canb.uscourts.gov';
  const singleDocPath = '/doc1/034031424909';
  const docketDisplayPath = '/cgi-bin/DktRpt.pl?101092135737069-L_1_0-1';
  const docketQueryPath = '/cgi-bin/DktRpt.pl?531591';
  const historyDocketPath = '/cgi-bin/HistDocQry.pl?101092135737069-L_1_0-1';

  // 'url' values
  const docketQueryUrl = districtCourtURI.concat(docketQueryPath);
  const docketDisplayUrl = districtCourtURI.concat(docketDisplayPath);
  const singleDocUrl = districtCourtURI.concat(singleDocPath);
  const historyDocketDisplayUrl = districtCourtURI.concat(historyDocketPath);
  const nonsenseUrl = 'http://something.uscourts.gov/foobar/baz';

  const appellateURL = ''; // Todo get good example value
  const appellatePath = ''; // Todo get good example value

  // Smallest possible PDF according to:
  // http://stackoverflow.com/questions/17279712/what-is-the-smallest-possible-valid-pdf
  const pdf_data = ('%PDF-1.\ntrailer<</Root<</Pages<</Kids' +
    '[<</MediaBox[0 0 3 3]>>]>>>>>>\n');

  // 'instances'
  const nonsenseUrlContentDelegate = new ContentDelegate(tabId, nonsenseUrl, []);

  const noPacerCaseIdContentDelegate = new ContentDelegate(
    tabId, // tabId
    docketQueryUrl, // url
    docketQueryPath, // path
    'canb', // court
    undefined, // pacer_case_id
    undefined, // pacer_doc_id
    [] // links
  );

  const docketQueryContentDelegate = new ContentDelegate(tabId,
    docketQueryUrl, docketQueryPath, 'canb', '531591', undefined, []);
  const docketDisplayContentDelegate = new ContentDelegate(tabId,
    docketDisplayUrl, docketDisplayPath, 'canb', '531591', undefined, []);
  const historyDocketDisplayContentDelegate = new ContentDelegate(tabId,
    historyDocketDisplayUrl, docketDisplayPath, 'canb', '531591', undefined, []);
  const appellateContentDelegate = new ContentDelegate(
    tabId, appellateURL, appellatePath, 'ca9', '1919', undefined, []);
  const singleDocContentDelegate =
    new ContentDelegate(tabId, singleDocUrl, singleDocPath, 'canb', '531591', undefined, []);
  //TODO
  function setupChromeSpy() {
    window.chrome = {
      extension: { getURL: jasmine.createSpy() },
      storage: {
        local: {
          get: jasmine.createSpy().and.callFake(function (
            _, cb) { cb({ options: {} }); }),
          set: jasmine.createSpy('set').and.callFake(function () { }),
          remove: jasmine.createSpy('remove').and.callFake(() => { })
        }
      }
    }
  }
  function removeChromeSpy() {
    delete window.chrome;
  }

  let nativeFetch;
  beforeEach(function () {
    nativeFetch = window.fetch;
    window.fetch = () => Promise.resolve(new window.Response(
      new Blob([pdf_data], { type: 'application/pdf' }),
      { status: 200, }
    ));
    jasmine.Ajax.install();
    setupChromeSpy();
  });

  afterEach(function () {
    jasmine.Ajax.uninstall();
    removeChromeSpy();
    window.fetch = nativeFetch;
  });

  describe('ContentDelegate constructor', function () {
    const expected_url = 'https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?531591';
    const restricted_url = 'https://ecf.canb.uscourts.gov/doc1/04503837920';
    const expected_path = '/cgi-bin/DktRpt.pl?531591';
    const expected_court = 'canb';
    const expected_pacer_case_id = '531591';
    const expected_pacer_doc_id = '127015406472';
    const link_0 = document.createElement('a');
    link_0.href = 'http://foo/bar/0';
    const link_1 = document.createElement('a');
    link_1.href = 'http://foo/bar/1';
    const expected_links = [link_0, link_1];
    const expected_tabId = 1234;

    it('gets created with necessary arguments', function () {
      const cd = new ContentDelegate(tabId, expected_url, expected_path, expected_court,
        expected_pacer_case_id, expected_pacer_doc_id,
        expected_links);
      expect(cd.tabId).toBe(expected_tabId);
      expect(cd.url).toBe(expected_url);
      expect(cd.path).toBe(expected_path);
      expect(cd.court).toBe(expected_court);
      expect(cd.pacer_case_id).toBe(expected_pacer_case_id);
      expect(cd.pacer_doc_id).toBe(expected_pacer_doc_id);
      expect(cd.links).toEqual(expected_links);
      expect(cd.restricted).toBe(false);
    });

    it('should flag restriction for Warning!', function () {
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.value = 'View Document';
      form.appendChild(input);
      document.body.appendChild(form);

      const table = document.createElement('table');
      const table_tr = document.createElement('tr');
      const table_td = document.createElement('td');
      table.appendChild(table_tr);
      table_tr.appendChild(table_td);
      document.body.appendChild(table);
      table_td.textContent = "Warning! Image";

      expect(document.body.innerText).not.toContain('will not be uploaded');
      const cd = new ContentDelegate(tabId, restricted_url, expected_path, expected_court,
        expected_pacer_case_id, expected_pacer_doc_id, expected_links);
      expect(cd.restricted).toBe(true);
      expect(document.body.innerText).toContain('will not be uploaded');
      table.remove();
      form.remove();
    });

    it('should flag restriction for bold restriction', function () {
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.value = 'View Document';
      form.appendChild(input);
      document.body.appendChild(form);

      const table_td = document.createElement('td');
      document.body.appendChild(table_td);
      table_td.textContent = "Image";

      const paragraph = document.createElement('p');
      const bold = document.createElement('b');
      paragraph.appendChild(bold);
      document.body.appendChild(paragraph);
      bold.textContent = "SEALED";

      expect(document.body.innerText).not.toContain('will not be uploaded');
      const cd = new ContentDelegate(tabId, restricted_url, expected_path, expected_court,
        expected_pacer_case_id, expected_pacer_doc_id, expected_links);
      expect(cd.restricted).toBe(true);
      expect(document.body.innerText).toContain('will not be uploaded');
      paragraph.remove();
      form.remove();
    });
  });

  describe('handleDocketQueryUrl', function () {
    let form;
    beforeEach(function () {
      form = document.createElement('form');
      document.body.appendChild(form);
    });

    afterEach(function () {
      form.remove();
    });

    it('has no effect when not on a docket query url', function () {
      const cd = nonsenseUrlContentDelegate;
      spyOn(PACER, 'hasPacerCookie');
      spyOn(PACER, 'isDocketQueryUrl').and.returnValue(false);
      cd.handleDocketQueryUrl();
      expect(PACER.hasPacerCookie).not.toHaveBeenCalled();
    });

    it('checks for a Pacer cookie', function () {
      // test is dependent on function order of operations, but does exercise all existing branches
      const cd = nonsenseUrlContentDelegate;
      spyOn(cd.recap, 'getAvailabilityForDocket');
      spyOn(PACER, 'hasPacerCookie').and.returnValue(false);
      spyOn(PACER, 'isDocketQueryUrl').and.returnValue(true);
      cd.handleDocketQueryUrl();
      expect(cd.recap.getAvailabilityForDocket).not.toHaveBeenCalled();
    });

    it('handles zero results from getAvailabilityForDocket', function () {
      const cd = docketQueryContentDelegate;
      spyOn(PACER, 'hasPacerCookie').and.returnValue(true);
      cd.handleDocketQueryUrl();
      jasmine.Ajax.requests.mostRecent().respondWith({
        'status': 200,
        'contentType': 'application/json',
        'responseText':
          ('{"count": 0, "results": []}')
      });
      expect(form.innerHTML).toBe('');
    });

    it('inserts the RECAP banner on an appropriate page', function () {
      const cd = docketQueryContentDelegate;
      spyOn(PACER, 'hasPacerCookie').and.returnValue(true);
      cd.handleDocketQueryUrl();
      jasmine.Ajax.requests.mostRecent().respondWith({
        'status': 200,
        'contentType': 'application/json',
        'responseText':
          ('{"count": 1, "results": [' +
            '{"date_modified": "04\/16\/15", "absolute_url": ' +
            '"/download\/gov.uscourts.' +
            'canb.531591\/gov.uscourts.canb.531591.docket.html"}]}')
      });
      const banner = document.querySelector('.recap-banner');
      expect(banner).not.toBeNull();
      expect(banner.innerHTML).toContain('04/16/15');
      const link = banner.querySelector('a');
      expect(link).not.toBeNull();
      expect(link.href).toBe(
        'https://www.courtlistener.com/download/gov.uscourts.' +
        'canb.531591/gov.uscourts.canb.531591.docket.html')
    });

    it('has no effect when on a docket query that has no RECAP', function () {
      const cd = docketQueryContentDelegate;
      spyOn(PACER, 'hasPacerCookie').and.returnValue(true);
      cd.handleDocketQueryUrl();
      jasmine.Ajax.requests.mostRecent().respondWith({
        'status': 200,
        'contentType': 'application/json',
        'responseText': '{}'
      });
      const banner = document.querySelector('.recap-banner');
      expect(banner).toBeNull();
    });
  });

  describe('handleDocketDisplayPage', function () {
    describe('option disabled', function () {
      beforeEach(function () {
        window.chrome = {
          storage: {
            local: {
              get: jasmine.createSpy().and.callFake((_, cb) => {
                cb({
                  ['1234']: { caseId: '531591' },
                  options: { recap_enabled: false }
                });
              }),
              set: jasmine.createSpy('set').and.callFake(function () { })
            }
          }
        };
      });

      afterEach(function () {
        delete window.chrome;
      });

      it('has no effect when recap_enabled option is false', function () {
        const cd = docketDisplayContentDelegate;
        spyOn(cd.recap, 'uploadDocket');
        cd.handleDocketDisplayPage();
        expect(cd.recap.uploadDocket).not.toHaveBeenCalled();
      });
    });

    describe('option enabled', function () {
      beforeEach(function () {
        const table = document.createElement('table');
        const tbody = document.createElement('tbody');
        const tr = document.createElement('tr');
        tbody.appendChild(tr);
        table.appendChild(tbody)
        document.querySelector('body').appendChild(table);
        window.chrome = {
          extension: { getURL: jasmine.createSpy('gerURL'), },
          storage: {
            local: {
              get: jasmine.createSpy().and.callFake((_, cb) => {
                cb({
                  [1234]: { caseId: '531591' },
                  options: { recap_enabled: true }
                });
              }),
              set: jasmine.createSpy('set').and.callFake(function () { })
            }
          }
        };
      });

      afterEach(function () {
        document.querySelector('table').remove();
        delete window.chrome;
      });

      it('has no effect when not on a docket display url', function () {
        const cd = nonsenseUrlContentDelegate;
        spyOn(cd.recap, 'uploadDocket');
        cd.handleDocketDisplayPage();
        expect(cd.recap.uploadDocket).not.toHaveBeenCalled();
      });

      it('has no effect when there is no casenum', function () {
        const cd = new ContentDelegate(tabId, docketDisplayUrl, undefined, 'canb', undefined, undefined, []);
        spyOn(cd.recap, 'uploadDocket');
        cd.handleDocketDisplayPage();
        expect(cd.recap.uploadDocket).not.toHaveBeenCalled();
      });

      describe('when the history state is already set', function () {
        beforeEach(function () {
          history.replaceState({ uploaded: true }, '');
        });

        afterEach(function () {
          history.replaceState({}, '');
        });

        it('has no effect', function () {
          const cd = docketDisplayContentDelegate;
          spyOn(cd.recap, 'uploadDocket');
          cd.handleDocketDisplayPage();
          expect(cd.recap.uploadDocket).not.toHaveBeenCalled();
        });
      });
      // interstitial check is multiple inputs with name 'date_from' and type 'radio'
      describe('when the docket page is an interstitial page', function () {
        beforeEach(function () {
          const input = document.createElement('input');
          input.id = "input1"
          input.name = 'date_from';
          input.type = 'radio';
          const input2 = input.cloneNode();
          input2.id = "input2";
          document.body.appendChild(input);
          document.body.appendChild(input2);
        });

        afterEach(function () {
          document.getElementById('input1').remove();
          document.getElementById('input2').remove();
        });

        it('does not call uploadDocket', async function () {
          const cd = docketDisplayContentDelegate;
          spyOn(cd.recap, 'uploadDocket');
          await cd.handleDocketDisplayPage();
          expect(cd.recap.uploadDocket).not.toHaveBeenCalled();
        });
      });
      describe('when the docket page is not an interstitial page', function () {

        it ('inserts a button linking the user to a create alert page on CL', async () => {
          const cd = docketDisplayContentDelegate;
          await cd.handleDocketDisplayPage();
          const button = document.getElementById('recap-alert-button');
          expect(button).not.toBeNull();
        });

        it('calls uploadDocket and responds to a positive result', async function () {
          const cd = docketDisplayContentDelegate;
          spyOn(cd.notifier, 'showUpload');
          spyOn(cd.recap, 'uploadDocket').and.callFake((pc, pci, h, ut, cb) => {
            cb.tab = { id: 1234 }
            cb(true);
          });
          spyOn(history, 'replaceState');

          await cd.handleDocketDisplayPage();
          expect(cd.recap.uploadDocket).toHaveBeenCalled();
          expect(cd.notifier.showUpload).toHaveBeenCalled();
          expect(history.replaceState).toHaveBeenCalledWith({ uploaded: true }, '');
          const button = document.getElementById('recap-alert-button');
          expect(button.className.includes('disabled')).not.toBe(true);
          expect(button.getAttribute('aria-disabled')).toBe('false');
        });

        it('calls uploadDocket and responds to a positive historical result', async function () {
          const cd = historyDocketDisplayContentDelegate;
          spyOn(cd.notifier, 'showUpload');
          spyOn(cd.recap, 'uploadDocket').and.callFake((pc, pci, h, ut, cb) => {
            cb.tab = { id: 1234 }
            cb(true);
          });
          spyOn(history, 'replaceState');

          await cd.handleDocketDisplayPage();
          expect(cd.recap.uploadDocket).toHaveBeenCalled();
          expect(cd.notifier.showUpload).toHaveBeenCalled();
          expect(history.replaceState).toHaveBeenCalledWith({ uploaded: true }, '');
          const button = document.getElementById('recap-alert-button');
          expect(button.className.includes('disabled')).not.toBe(true);
          expect(button.getAttribute('aria-disabled')).toBe('false');
        });

        it('calls uploadDocket and responds to a negative result', async function () {
          const cd = docketDisplayContentDelegate;
          spyOn(cd.notifier, 'showUpload');
          spyOn(cd.recap, 'uploadDocket').and.callFake((pc, pci, h, ut, cb) => {
            cb.tab = { id: 1234 }
            cb(false);
          });
          spyOn(history, 'replaceState');

          await cd.handleDocketDisplayPage();
          expect(cd.recap.uploadDocket).toHaveBeenCalled();
          expect(cd.notifier.showUpload).not.toHaveBeenCalled();
          expect(history.replaceState).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('handleAttachmentMenuPage', function () {
    describe('option disabled', function () {
      let form;
      let input;

      beforeEach(function () {
        form = document.createElement('form');
        document.body.appendChild(form);
        window.chrome = {
          storage: {
            local: {
              get: jasmine.createSpy().and.callFake(function (
                _, cb) { cb({ options: { recap_enabled: false } }); }),
              set: jasmine.createSpy('set').and.callFake(function () { })
            }
          }
        };
        input = document.createElement('input');
        input.value = 'Download All';
        form.appendChild(input);
      });

      afterEach(function () {
        form.remove();
        delete window.chrome;
      });

      it('has no effect recap_enabled option is not set', function () {
        const cd = singleDocContentDelegate;
        spyOn(cd.recap, 'uploadAttachmentMenu');
        cd.handleAttachmentMenuPage();
        expect(cd.recap.uploadAttachmentMenu).not.toHaveBeenCalled();
      });
    });

    describe('option enabled', function () {
      let form;
      beforeEach(function () {
        form = document.createElement('form');
        document.body.appendChild(form);
        window.chrome = {
          storage: {
            local: {
              get: jasmine.createSpy().and.callFake(function (
                _, cb) { cb({ options: { recap_enabled: true } }); }),
              set: jasmine.createSpy('set').and.callFake(function () { })
            }
          }
        };
      });

      afterEach(function () {
        form.remove();
        delete window.chrome;
      });

      describe('when the history state is already set', function () {
        beforeEach(function () {
          history.replaceState({ uploaded: true }, '');
        });

        afterEach(function () {
          history.replaceState({}, '');
        });

        it('has no effect', function () {
          const cd = docketDisplayContentDelegate;
          spyOn(cd.recap, 'uploadAttachmentMenu');
          cd.handleAttachmentMenuPage();
          expect(cd.recap.uploadAttachmentMenu).not.toHaveBeenCalled();
        });
      });

      describe('when there is NO appropriate form', function () {
        it('has no effect when the URL is wrong', function () {
          const cd = nonsenseUrlContentDelegate;
          spyOn(cd.recap, 'uploadAttachmentMenu');
          cd.handleAttachmentMenuPage();
          expect(cd.recap.uploadAttachmentMenu).not.toHaveBeenCalled();
        });

        it('has no effect with a proper URL', function () {
          const cd = singleDocContentDelegate;
          spyOn(cd.recap, 'uploadAttachmentMenu');
          cd.handleAttachmentMenuPage();
          expect(cd.recap.uploadAttachmentMenu).not.toHaveBeenCalled();
        });
      });

      describe('when there IS an appropriate form', function () {
        let input;
        beforeEach(function () {
          input = document.createElement('input');
          input.value = 'Download All';
          form.appendChild(input);
        });

        it('has no effect when the URL is wrong', function () {
          const cd = nonsenseUrlContentDelegate;
          spyOn(cd.recap, 'uploadAttachmentMenu');
          cd.handleAttachmentMenuPage();
          expect(cd.recap.uploadAttachmentMenu).not.toHaveBeenCalled();
        });

        it('uploads the page when the URL is right', function () {
          const cd = singleDocContentDelegate;
          spyOn(cd.recap, 'uploadAttachmentMenu');
          cd.handleAttachmentMenuPage();
          expect(cd.recap.uploadAttachmentMenu).toHaveBeenCalled();
        });

        it('calls the upload method and responds to positive result', function () {
          const cd = singleDocContentDelegate;
          const uploadFake = function (pc, pci, h, callback) { callback(true); };
          spyOn(cd.recap, 'uploadAttachmentMenu').and.callFake(uploadFake);
          spyOn(cd.notifier, 'showUpload');
          spyOn(history, 'replaceState');

          cd.handleAttachmentMenuPage();
          expect(cd.recap.uploadAttachmentMenu).toHaveBeenCalled();
          expect(cd.notifier.showUpload).toHaveBeenCalled();
          expect(history.replaceState)
            .toHaveBeenCalledWith({ uploaded: true }, '');
        });

        it('calls the upload method and responds to negative result', function () {
          const cd = singleDocContentDelegate;
          const uploadFake = function (pc, pci, h, callback) { callback(false); };
          spyOn(cd.recap, 'uploadAttachmentMenu').and.callFake(uploadFake);
          spyOn(cd.notifier, 'showUpload');
          spyOn(history, 'replaceState');

          cd.handleAttachmentMenuPage();
          expect(cd.recap.uploadAttachmentMenu).toHaveBeenCalled();
          expect(cd.notifier.showUpload).not.toHaveBeenCalled();
          expect(history.replaceState).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('handleSingleDocumentPageCheck', function () {
    let form;
    beforeEach(function () {
      form = document.createElement('form');
      document.body.appendChild(form);
    });

    afterEach(function () {
      form.remove();
    });

    describe('when there is NO appropriate form', function () {
      it('has no effect when the URL is wrong', function () {
        const cd = nonsenseUrlContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageCheck();
        expect(cd.recap.getAvailabilityForDocuments).not.toHaveBeenCalled();
      });

      it('has no effect with a proper URL', function () {
        const cd = singleDocContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageCheck();
        expect(cd.recap.getAvailabilityForDocuments).not.toHaveBeenCalled();
      });
    });

    describe('when there IS an appropriate form', function () {
      let input;
      let table;

      beforeEach(function () {
        input = document.createElement('input');
        input.value = 'View Document';
        form.appendChild(input);

        table = document.createElement('table');
        const table_tr = document.createElement('tr');
        const table_td = document.createElement('td');
        table_td.appendChild(document.createTextNode('Image'));
        table_tr.appendChild(table_td);
        table.appendChild(table_tr);
        document.body.appendChild(table);
      });

      afterEach(function () {
        // no need to remove input because it is added to
        // the form and removed in the outer scope
        table.remove();
      });

      it('has no effect when the URL is wrong', function () {
        const cd = nonsenseUrlContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageCheck();
        expect(cd.recap.getAvailabilityForDocuments).not.toHaveBeenCalled();
      });

      it('checks availability for the page when the URL is right', function () {
        const cd = singleDocContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageCheck();
        expect(cd.recap.getAvailabilityForDocuments).toHaveBeenCalled();
      });

      describe('for pacer doc id 531591', function () {
        beforeEach(function () {
          window.pacer_doc_id = 531591;
        });

        afterEach(function () {
          delete window.pacer_doc_id
        });

        it('responds to a positive result', function () {
          const fakePacerDocId = 531591;
          const cd = singleDocContentDelegate;
          const fake = function (pc, pci, callback) {
            const response = {
              results: [{
                pacer_doc_id: fakePacerDocId,
                filepath_local: 'download/1234'
              }]
            };
            callback(response);
          };
          spyOn(cd.recap, 'getAvailabilityForDocuments').and.callFake(fake);

          cd.handleSingleDocumentPageCheck();

          expect(cd.recap.getAvailabilityForDocuments).toHaveBeenCalled();
          const banner = document.querySelector('.recap-banner');
          expect(banner).not.toBeNull();
          const link = banner.querySelector('a');
          expect(link).not.toBeNull();
          expect(link.href).toBe('https://www.courtlistener.com/download/1234');
        });

        it('responds to a negative result', function () {
          const cd = singleDocContentDelegate;
          const fake = function (pc, pci, callback) {
            const response = {
              results: [{}]
            };
            callback(response);
          };
          spyOn(cd.recap, 'getAvailabilityForDocuments').and.callFake(fake);

          cd.handleSingleDocumentPageCheck();

          expect(cd.recap.getAvailabilityForDocuments).toHaveBeenCalled();
          const banner = document.querySelector('.recap-banner');
          expect(banner).toBeNull();
        });
      });
    });
  });

  describe('handleSingleDocumentPageView', function () {
    let form;
    beforeEach(function () {
      form = document.createElement('form');
      document.body.appendChild(form);
    });

    afterEach(function () {
      form.remove();
    });

    it('handles appellate check', function () {
      const cd = appellateContentDelegate;
      spyOn(console, 'log');
      spyOn(PACER, 'isSingleDocumentPage').and.returnValue(true);
      let restore = DEBUGLEVEL;
      DEBUGLEVEL = 4;
      cd.handleSingleDocumentPageView();
      expect(console.log).toHaveBeenCalledWith('RECAP debug [4]: No interposition for appellate downloads yet');
      DEBUGLEVEL = restore;
    });

    describe('when there is NO appropriate form', function () {
      it('has no effect when the URL is wrong', function () {
        const cd = nonsenseUrlContentDelegate;
        spyOn(document, 'createElement');
        cd.handleSingleDocumentPageView();
        expect(document.createElement).not.toHaveBeenCalled();
      });

      it('has no effect with a proper URL', function () {
        const cd = singleDocContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageView();
        expect(cd.recap.getAvailabilityForDocuments).not.toHaveBeenCalled();
      });
    });

    describe('when there IS an appropriate form', function () {
      let input;
      let table;

      beforeEach(function () {
        input = document.createElement('input');
        input.value = 'View Document';
        form.appendChild(input);

        table = document.createElement('table');
        const table_tr = document.createElement('tr');
        const table_td = document.createElement('td');
        table_td.appendChild(document.createTextNode('Image'));
        table_tr.appendChild(table_td);
        table.appendChild(table_tr);
        document.body.appendChild(table);
        spyOn(window, 'addEventListener').and.callThrough();
      });

      afterEach(function () {
        table.remove();
        const scripts = [...document.querySelectorAll('script')];
        const lastScript = scripts.find(script => script.innerText.match(/^document\.createElement/));
        if (lastScript) {
          lastScript.remove();
        };
      });

      it('creates a non-empty script element', function () {
        const cd = singleDocContentDelegate;
        const scriptSpy = {};
        spyOn(document, 'createElement').and.returnValue(scriptSpy);
        spyOn(document.body, 'appendChild');
        cd.handleSingleDocumentPageView();

        expect(document.createElement).toHaveBeenCalledWith('script');
        expect(scriptSpy.innerText).toEqual(jasmine.any(String));
        expect(document.body.appendChild).toHaveBeenCalledWith(scriptSpy);
      });

      it('adds an event listener for the message in the script', function () {
        const cd = singleDocContentDelegate;
        cd.handleSingleDocumentPageView();

        expect(window.addEventListener)
          .toHaveBeenCalledWith('message', jasmine.any(Function), false);
      });
    });
  });

  describe('onDocumentViewSubmit', function () {
    let form;
    let table;
    const form_id = '1234';
    const event = { data: { id: form_id } };

    beforeEach(function () {
      form = document.createElement('form');
      form.id = form_id;
      document.body.appendChild(form);

      table = document.createElement('table');
      let tr_image = document.createElement('tr');
      let td_image = document.createElement('td');
      td_image.innerHTML = 'Image 1234-9876';
      tr_image.appendChild(td_image);
      table.appendChild(tr_image);
      document.body.appendChild(table);
    });

    afterEach(function () {
      form.remove();
      table.remove();
    });

    it('handles appellate check', function () {
      const cd = appellateContentDelegate;
      spyOn(console, 'log');
      let restore = DEBUGLEVEL;
      DEBUGLEVEL = 4;
      cd.onDocumentViewSubmit(event);
      expect(console.log).toHaveBeenCalledWith('RECAP debug [4]: Appellate parsing not yet implemented');
      DEBUGLEVEL = restore;
    });

    it('sets the onsubmit attribute of the page form', function () {
      const expected_on_submit = 'expectedOnSubmit();';
      form.setAttribute('onsubmit', expected_on_submit);
      spyOn(form, 'setAttribute');
      singleDocContentDelegate.onDocumentViewSubmit(event);

      expect(form.setAttribute)
        .toHaveBeenCalledWith('onsubmit', 'history.forward(); return false;');
      expect(form.setAttribute)
        .toHaveBeenCalledWith('onsubmit', expected_on_submit);
    });

    it('calls showPdfPage when the response is a PDF', function () {
      const cd = singleDocContentDelegate;
      spyOn(cd, 'showPdfPage');
      cd.onDocumentViewSubmit(event);

      jasmine.Ajax.requests.mostRecent().respondWith({
        'status': 200,
        'contentType': 'application/pdf',
        'responseText': pdf_data
      });
      expect(cd.showPdfPage).toHaveBeenCalled();
    });

    it('calls showPdfPage when the response is HTML', function () {
      const cd = singleDocContentDelegate;
      const fakeFileReader = {
        readAsText: function () {
          this.result = '<html lang="en"></html>';
          this.onload();
        }
      };
      spyOn(window, 'FileReader')
        .and.callFake(function () { return fakeFileReader; });
      spyOn(cd, 'showPdfPage');
      cd.onDocumentViewSubmit(event);

      jasmine.Ajax.requests.mostRecent().respondWith({
        'status': 200,
        'contentType': 'text/html',
        'responseText': '<html lang="en"></html>'
      });
      expect(cd.showPdfPage).toHaveBeenCalled();
    });
  });

  describe('showPdfPage', function () {
    let documentElement;
    const pre = '<head><title>test</title><style>body { margin: 0; } iframe { border: none; }' +
      '</style></head><body>';
    const iFrameStart = '<iframe src="data:pdf"';
    const iFrameEnd = ' width="100%" height="100%"></iframe>';
    const post = '</body>';
    const html = pre + iFrameStart + iFrameEnd + post;
    const cd = singleDocContentDelegate;
    const blob = new Blob([new ArrayBuffer(1000)], { type: 'application/pdf' });

    beforeEach(async function () {
      const dataUrl = await blobToDataURL(blob);
      documentElement = document.createElement('html');
      window.chrome = {
        storage: {
          local: {
            get: jasmine.createSpy().and.callFake((_, cb) => {
              cb({
                options: {
                  recap_enabled: true,
                  ['ia_style_filenames']: true,
                  ['lawyer_style_filenames']: false,
                  ['external_pdf']: true
                },
                [tabId]: {
                  ['pdf_blob']: dataUrl,
                  docsToCases: { ['034031424909']: '531591' }
                }
              });
            }),
            remove: jasmine.createSpy('remove').and.callFake(function () { }),
            set: jasmine.createSpy('set').and.callFake(function () { })
          }
        }
      };
      spyOn(cd.recap, 'uploadDocument').and.callFake(
        (court, caseId, docId, docNumber, attachNumber, callback) => {
          callback.tab = { id: 1234 };
          callback(true);
        }
      );
    });

    afterEach(() => {
      delete window.chrome;
    });

    it('handles no iframe', function () {
      let inner = '<span>html</span>';
      cd.showPdfPage(documentElement, pre + inner + post);
      expect(document.documentElement.innerHTML).toBe(pre + inner + post);
    });

    it('correctly extracts the data before and after the iframe', async function () {
      await cd.showPdfPage(documentElement, html);
      // removed waiting check because the content_delegate
      // removes the paragraph if successful which seems to occur prior
      // to the test running - checking for the new Iframe should be sufficient
      const expected_iframe = '<iframe src="about:blank"' + iFrameEnd;
      expect(document.documentElement.innerHTML)
        .toBe(pre + expected_iframe + post);
    });

    describe('when it downloads the PDF in the iframe', function () {
      const casenum = '437098';
      const cd = singleDocContentDelegate;

      beforeEach(function () {
        spyOn(cd.recap, 'getPacerCaseIdFromPacerDocId').and.callFake(
          (pdi, callback) => {
            callback.tab = { id: 1234 };
            callback(casenum);
          }
        );
        spyOn(cd.notifier, 'showUpload').and.callFake((message, cb) => cb(true));
        spyOn(URL, 'createObjectURL').and.returnValue('data:blob');
        spyOn(history, 'pushState').and.callFake(() => { });

        window.saveAs = jasmine.createSpy('saveAs').and.callFake(() => Promise.resolve(true));
        // jasmine.Ajax.requests.mostRecent().respondWith({
        //   'status' : 200,
        //   'contentType' : 'application/pdf',
        //   'responseText' : pdf_data
        // });
      });

      it('makes the back button redisplay the previous page', async function () {
        await cd.showPdfPage(documentElement, html);
        expect(window.onpopstate).toEqual(jasmine.any(Function));
        window.onpopstate({ state: { content: 'previous' } });
        expect(document.documentElement.innerHTML).toBe('<head></head><body>previous</body>');
      });

      it('displays the page with the downloaded file in an iframe', async function () {
        await cd.showPdfPage(documentElement, html);
        if ((navigator.userAgent.indexOf('Chrome') < 0) &&
          navigator.plugins.namedItem('Chrome PDF Viewer')) {
          // isExternalPdf, file is saved with saveAs
          // Test fails on Chrome 78.0.3904 because carriage returns
          // are present in the grabbed html. A quick fix is to use
          // a set of non-null characters [^\0] instead of the dot
          // operator -- see https://www.regular-expressions.info/dot.html
          const iframe = document.querySelector('iframe[src="data:blob"]');
          expect(iframe).not.toBeNull();
        } else {
          const iframe = document.querySelector('iframe[src="about:blank"]');
          expect(iframe).not.toBeNull();
          expect(window.saveAs).toHaveBeenCalled();
        }
      });

      it('puts the generated HTML in the page history', async function () {
        await cd.showPdfPage(documentElement, html);
        if ((navigator.userAgent.indexOf('Chrome') < 0) &&
          navigator.plugins.namedItem('Chrome PDF Viewer')) {
          // isExternalPdf, file is saved with saveAs
          expect(history.pushState).toHaveBeenCalled();
        } else {
          expect(history.pushState).not.toHaveBeenCalled();
          expect(window.saveAs).toHaveBeenCalled();
        }
      });

      it('uploads the PDF to RECAP', async function () {
        await cd.showPdfPage(documentElement, html);
        expect(cd.recap.uploadDocument).toHaveBeenCalled();
      });

      it('calls the notifier once the upload finishes', async function () {
        await cd.showPdfPage(documentElement, html);
        expect(cd.notifier.showUpload).toHaveBeenCalled();
      });
    });
  });

  function linksFromUrls(urls) {
    let index;
    const links = [];
    for (index = 0; index < urls.length; index++) {
      const link = document.createElement('a');
      link.href = urls[index];
      if (index === 0) {
        link.dataset.pacer_doc_id = '1234';
      }
      links.push(link);
    }
    return links;
  }

  describe('findAndStorePacerDocIds', function () {

    it('should handle no cookie', function () {
      spyOn(PACER, 'hasPacerCookie').and.returnValue(false);
      expect(nonsenseUrlContentDelegate.findAndStorePacerDocIds()).toBe(undefined);
    });
    it('should handle pages without case ids', function () {
      const cd = noPacerCaseIdContentDelegate;
      spyOn(PACER, 'hasPacerCookie').and.returnValue(true);
      spyOn(cd.recap, 'getPacerCaseIdFromPacerDocId').and.callFake(
        (_, callback) => {
          callback.tab = { id: 1234 };
          callback('531931');
        });
      chrome.storage.local.set = function (docs, cb) {
        cb();
      };
      cd.findAndStorePacerDocIds();
      expect(cd.recap.getPacerCaseIdFromPacerDocId).toHaveBeenCalled();
    });
    it('should iterate links for DLS', async function () {
      const link_2 = document.createElement('a');
      link_2.href = 'https://ecf.canb.uscourts.gov/notacase/034031424909';
      const link_3 = document.createElement('a');
      link_3.href = 'https://ecf.canb.uscourts.gov/doc1/034031424910';
      const link_4 = document.createElement('a');
      link_4.href = 'https://ecf.canb.uscourts.gov/doc1/034031424911';
      const test_links = [link_2, link_3, link_4];
      const docketQueryWithLinksContentDelegate = new ContentDelegate(
        tabId, // tabId
        docketQueryUrl, // url
        docketQueryPath, // path
        'canb', // court
        undefined, // pacer_case_id
        '127015406472', // pacer_doc_id
        test_links // links
      );

      let documents = {};
      spyOn(PACER, 'hasPacerCookie').and.returnValue(true);
      spyOn(PACER, 'parseGoDLSFunction').and.returnValue({ 'de_caseid': '1234' });
      const cd = docketQueryWithLinksContentDelegate;
      chrome.storage.local.set = function (storagePayload, cb) {
        const docs = storagePayload[tabId].docsToCases;
        documents = docs;
        cb();
      };
      spyOn(cd.recap, 'getPacerCaseIdFromPacerDocId').and.callFake(
        (_, callback) => {
          callback.tab = { id: 1234 };
          return Promise.resolve(callback('531931'));
        }
      );
      await cd.findAndStorePacerDocIds();
      expect(documents).toEqual({ "034031424910": "1234", "034031424911": "1234" });
    });
    it('should iterate links for PACER case id', async function () {
      const link_2 = document.createElement('a');
      link_2.href = 'https://ecf.canb.uscourts.gov/notacase/034031424909';
      const link_3 = document.createElement('a');
      link_3.href = 'https://ecf.canb.uscourts.gov/doc1/034031424910';
      const link_4 = document.createElement('a');
      link_4.href = 'https://ecf.canb.uscourts.gov/doc1/034031424911';
      const test_links = [link_2, link_3, link_4];
      const docketQueryWithLinksContentDelegate = new ContentDelegate(
        tabId,
        docketQueryUrl, // url
        docketQueryPath, // path
        'canb', // court
        '123456', // pacer_case_id
        'redfox', // pacer_doc_id
        test_links // links
      );
      let documents = {};
      spyOn(PACER, 'hasPacerCookie').and.returnValue(true);
      const cd = docketQueryWithLinksContentDelegate;
      chrome.storage.local.set = function (storagePayload, cb) {
        const docs = storagePayload[tabId].docsToCases;
        documents = docs;
        cb();
      };
      await cd.findAndStorePacerDocIds();
      expect(documents).toEqual({
        "redfox": "123456",
        "034031424910": "123456",
        "034031424911": "123456"
      });
    });
  });

  // TODO: Figure out where the functionality of
  //  'addMouseoverToConvertibleLinks' went, and add tests for that.

  describe('handleRecapLinkClick', function () {
    const cd = docketDisplayContentDelegate;
    const linkUrl = singleDocUrl;

    afterEach(function () {
      delete window.chrome;
    });

    describe('when the popup option is not set', function () {
      beforeEach(function () {
        window.chrome = {
          storage: {
            local: {
              get: jasmine.createSpy().and.callFake(function (
                _, cb) { cb({ options: {} }); })
            }
          }
        };
      });

      it('redirects to the link url immediately', function () {
        const window_obj = {};
        cd.handleRecapLinkClick(window_obj, linkUrl);
        expect(window_obj.location).toBe(linkUrl);
      });
    });

    describe('when the popup option is set', function () {
      beforeEach(function () {
        window.chrome = {
          storage: {
            local: {
              get: jasmine.createSpy().and.callFake(function (
                _, cb) { cb({ options: { recap_link_popups: true } }); }),
              set: jasmine.createSpy('set').and.callFake(function () { })
            }
          }
        };
      });

      it('attaches the RECAP popup', function () {
        cd.handleRecapLinkClick({}, linkUrl);
        expect($('#recap-shade').length).not.toBe(0);
        expect($('.recap-popup').length).not.toBe(0);

        let foundLink = false;
        $('.recap-popup a').each(function (i, link) {
          if (link.href === linkUrl) {
            foundLink = true;
          }
        });
        expect(foundLink).toBe(true);
        document.getElementById('recap-shade').remove();
        document.getElementsByClassName('recap-popup')[0].remove();
      });
    });
  });

  describe('attachRecapLinkToEligibleDocs', function () {
    const fake_urls = [
      'http://foo.fake/bar/0',
      'http://foo.fake/bar/1',
    ];

    const urls = [
      'https://ecf.canb.uscourts.gov/doc1/034031424909',
      'https://ecf.canb.uscourts.gov/doc1/034031438754',
    ];
    const expected_url = 'https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?531591';

    describe('when there are no valid urls', function () {
      let links;
      let cd;
      beforeEach(function () {
        links = linksFromUrls(fake_urls);
        cd = new ContentDelegate(tabId, expected_url, null, null, null, null, links);
        cd.attachRecapLinkToEligibleDocs();
      });

      it('does nothing', function () {
        expect(jasmine.Ajax.requests.mostRecent()).toBeUndefined();
      });
    });

    describe('when there are valid urls', function () {
      let links;
      let cd;
      beforeEach(function () {
        links = linksFromUrls(urls);
        $('body').append(links);
        cd = new ContentDelegate(tabId, expected_url, null, null, null, null, links);
        cd.pacer_doc_ids = [1234];
      });

      afterEach(function () {
        for (let link of links) {
          link.remove();
        }
      });

      it('does not attach any links if no urls have recap', function () {
        spyOn(cd.recap, 'getAvailabilityForDocuments')
          .and.callFake(function (pc, pci, callback) {
            callback({
              results: [],
            });
          });
        cd.attachRecapLinkToEligibleDocs();
        expect($('.recap-inline').length).toBe(0);
      });

      it('attaches a single link to the one url with recap', function () {
        spyOn(cd.recap, 'getAvailabilityForDocuments')
          .and.callFake(function (pc, pci, callback) {
            callback({
              results:
                [{ pacer_doc_id: 1234, filepath_local: 'download/1234' }],
            });
          });
        cd.attachRecapLinkToEligibleDocs();
        expect($('.recap-inline').length).toBe(1);
        document.getElementsByClassName('recap-inline')[0].remove();
      });

      it('attaches a working click handler', function () {
        spyOn(cd, 'handleRecapLinkClick');
        spyOn(cd.recap, 'getAvailabilityForDocuments')
          .and.callFake(function (pc, pci, callback) {
            callback({
              results:
                [{ pacer_doc_id: 1234, filepath_local: 'download/1234' }],
            });
          });
        cd.attachRecapLinkToEligibleDocs();
        $(links[0]).next().click();
        expect(cd.handleRecapLinkClick).toHaveBeenCalled();
        document.getElementsByClassName('recap-inline')[0].remove();
      });
    });
  });
});
