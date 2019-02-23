describe('The ContentDelegate class', function() {
  const docketQueryUrl = 'https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?531591';
  const docketQueryPath = '/cgi-bin/DktRpt.pl?531591';
  const docketDisplayUrl = ('https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?' +
      '101092135737069-L_1_0-1');
  const docketDisplayPath = '/cgi-bin/DktRpt.pl?101092135737069-L_1_0-1';
  const singleDocUrl = 'https://ecf.canb.uscourts.gov/doc1/034031424909';
  const singleDocPath = '/doc1/034031424909';
  const nonsenseUrl = 'http://something.uscourts.gov/foobar/baz';
  // Smallest possible PDF according to:
  // http://stackoverflow.com/questions/17279712/what-is-the-smallest-possible-valid-pdf
  const pdf_data = ('%PDF-1.\ntrailer<</Root<</Pages<</Kids' +
      '[<</MediaBox[0 0 3 3]>>]>>>>>>\n');

  let nonsenseUrlContentDelegate = new ContentDelegate(nonsenseUrl);
  let docketQueryContentDelegate = new ContentDelegate(
      docketQueryUrl, docketQueryPath, 'canb', '531591', []);
  let docketDisplayContentDelegate = new ContentDelegate(
      docketDisplayUrl, docketDisplayPath, 'canb', '531591', []);
  let singleDocContentDelegate =
      new ContentDelegate(singleDocUrl, singleDocPath, 'canb', '531591', []);

  function setupChromeSpy() {
    window.chrome = {
      extension : {getURL : jasmine.createSpy()},
      storage : {
        local : {
          get : jasmine.createSpy().and.callFake(function(
              _, cb) { cb({options : {}}); })
        }
      }
    }
  }

  function removeChromeSpy() { delete window.chrome; }

  beforeEach(function() {
    jasmine.Ajax.install();
    setupChromeSpy();
  });

  afterEach(function() {
    jasmine.Ajax.uninstall();
    removeChromeSpy();
  });

  it('gets created with necessary arguments', function() {
    const expected_url = 'https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?531591';
    const expected_path = '/cgi-bin/DktRpt.pl?531591';
    const expected_court = 'canb';
    const expected_pacer_case_id = '531591';
    const expected_pacer_doc_id = '127015406472';
    let link_0 = document.createElement('a');
    link_0.href = 'http://foo/bar/0';
    let link_1 = document.createElement('a');
    link_1.href = 'http://foo/bar/1';
    let expected_links = [link_0, link_1];

    let cd = new ContentDelegate(expected_url, expected_path, expected_court,
        expected_pacer_case_id, expected_pacer_doc_id,
        expected_links);
    expect(cd.url).toBe(expected_url);
    expect(cd.path).toBe(expected_path);
    expect(cd.court).toBe(expected_court);
    expect(cd.pacer_case_id).toBe(expected_pacer_case_id);
    expect(cd.pacer_doc_id).toBe(expected_pacer_doc_id);
    expect(cd.links).toEqual(expected_links);
  });

  describe('handleDocketQueryUrl', function() {
    let form;
    beforeEach(function() {
      form = document.createElement('form');
      document.body.appendChild(form);
    });

    afterEach(function() { form.parentNode.removeChild(form); });

    it('has no effect when not on a docket query url', function() {
      let cd = nonsenseUrlContentDelegate;
      spyOn(cd.recap, 'getAvailabilityForDocket');
      spyOn(PACER, 'hasPacerCookie').and.returnValue(true);
      cd.handleDocketQueryUrl();
      expect(cd.recap.getAvailabilityForDocket).not.toHaveBeenCalled();
    });

    it('inserts the RECAP banner on an appropriate page', function() {
      let cd = docketQueryContentDelegate;
      spyOn(PACER, 'hasPacerCookie').and.returnValue(true);
      cd.handleDocketQueryUrl();
      jasmine.Ajax.requests.mostRecent().respondWith({
        'status' : 200,
        'contentType' : 'application/json',
        'responseText' :
            ('{"count": 1, "results": [' +
             '{"date_modified": "04\/16\/15", "absolute_url": ' +
             '"/download\/gov.uscourts.' +
             'canb.531591\/gov.uscourts.canb.531591.docket.html"}]}')
      });
      let banner = document.querySelector('.recap-banner');
      expect(banner).not.toBeNull();
      expect(banner.innerHTML).toContain('04/16/15');
      let link = banner.querySelector('a');
      expect(link).not.toBeNull();
      expect(link.href).toBe(
          'https://www.courtlistener.com/download/gov.uscourts.' +
          'canb.531591/gov.uscourts.canb.531591.docket.html')
    });

    it('has no effect when on a docket query that has no RECAP', function() {
      let cd = docketQueryContentDelegate;
      spyOn(PACER, 'hasPacerCookie').and.returnValue(true);
      cd.handleDocketQueryUrl();
      jasmine.Ajax.requests.mostRecent().respondWith({
        'status' : 200,
        'contentType' : 'application/json',
        'responseText' : '{}'
      });
      let banner = document.querySelector('.recap-banner');
      expect(banner).toBeNull();
    });
  });

  describe('handleDocketDisplayPage', function() {
    beforeEach(function() {
      window.chrome = {
        storage : {
          local : {
            get : jasmine.createSpy().and.callFake(function(
                _, cb) { cb({options : {}}); })
          }
        }
      };
    });

    afterEach(function() { delete window.chrome; });

    it('has no effect when not on a docket display url', function() {
      let cd = nonsenseUrlContentDelegate;
      spyOn(cd.recap, 'uploadDocket');
      cd.handleDocketDisplayPage();
      expect(cd.recap.uploadDocket).not.toHaveBeenCalled();
    });

    it('has no effect when there is no casenum', function() {
      let cd = new ContentDelegate(docketDisplayUrl);
      spyOn(cd.recap, 'uploadDocket');
      cd.handleDocketDisplayPage();
      expect(cd.recap.uploadDocket).not.toHaveBeenCalled();
    });

    describe('when the history state is already set', function() {
      beforeEach(function() { history.replaceState({uploaded : true}, ''); });

      afterEach(function() { history.replaceState({}, ''); });

      it('has no effect', function() {
        let cd = docketDisplayContentDelegate;
        spyOn(cd.recap, 'uploadDocket');
        cd.handleDocketDisplayPage();
        expect(cd.recap.uploadDocket).not.toHaveBeenCalled();
      });
    });

    it('calls uploadDocket and responds to a positive result', function() {
      let cd = docketDisplayContentDelegate;
      spyOn(cd.notifier, 'showUpload');
      spyOn(cd.recap, 'uploadDocket')
          .and.callFake(function(_, _, _, _, cb) { cb(true); });
      spyOn(history, 'replaceState');

      cd.handleDocketDisplayPage();
      expect(cd.recap.uploadDocket).toHaveBeenCalled();
      expect(cd.notifier.showUpload).toHaveBeenCalled();
      expect(history.replaceState).toHaveBeenCalledWith({uploaded : true}, '');
    });

    it('calls uploadDocket and responds to a negative result', function() {
      let cd = docketDisplayContentDelegate;
      spyOn(cd.notifier, 'showUpload');
      spyOn(cd.recap, 'uploadDocket')
          .and.callFake(function(_, _, _, _, cb) { cb(false); });
      spyOn(history, 'replaceState');

      cd.handleDocketDisplayPage();
      expect(cd.recap.uploadDocket).toHaveBeenCalled();
      expect(cd.notifier.showUpload).not.toHaveBeenCalled();
      expect(history.replaceState).not.toHaveBeenCalled();
    });
  });

  describe('handleAttachmentMenuPage', function() {
    let form;
    beforeEach(function() {
      form = document.createElement('form');
      document.body.appendChild(form);
      window.chrome = {
        storage : {
          local : {
            get : jasmine.createSpy().and.callFake(function(
                _, cb) { cb({options : {}}); })
          }
        }
      };
    });

    afterEach(function() {
      form.parentNode.removeChild(form);
      delete window.chrome;
    });

    describe('when there is NO appropriate form', function() {
      it('has no effect when the URL is wrong', function() {
        let cd = nonsenseUrlContentDelegate;
        spyOn(cd.recap, 'uploadAttachmentMenu');
        cd.handleAttachmentMenuPage();
        expect(cd.recap.uploadAttachmentMenu).not.toHaveBeenCalled();
      });

      it('has no effect with a proper URL', function() {
        cd = singleDocContentDelegate;
        spyOn(cd.recap, 'uploadAttachmentMenu');
        cd.handleAttachmentMenuPage();
        expect(cd.recap.uploadAttachmentMenu).not.toHaveBeenCalled();
      });
    });

    describe('when there IS an appropriate form', function() {
      let input;
      beforeEach(function() {
        input = document.createElement('input');
        input.value = 'Download All';
        form.appendChild(input);
      });

      afterEach(function() { form.removeChild(input); });

      it('has no effect when the URL is wrong', function() {
        let cd = nonsenseUrlContentDelegate;
        spyOn(cd.recap, 'uploadAttachmentMenu');
        cd.handleAttachmentMenuPage();
        expect(cd.recap.uploadAttachmentMenu).not.toHaveBeenCalled();
      });

      it('uploads the page when the URL is right', function() {
        let cd = singleDocContentDelegate;
        spyOn(cd.recap, 'uploadAttachmentMenu');
        cd.handleAttachmentMenuPage();
        expect(cd.recap.uploadAttachmentMenu).toHaveBeenCalled();
      });

      it('calls the upload method and responds to positive result', function() {
        let cd = singleDocContentDelegate;
        uploadFake = function(_, _, _, callback) { callback(true); };
        spyOn(cd.recap, 'uploadAttachmentMenu').and.callFake(uploadFake);
        spyOn(cd.notifier, 'showUpload');
        spyOn(history, 'replaceState');

        cd.handleAttachmentMenuPage();
        expect(cd.recap.uploadAttachmentMenu).toHaveBeenCalled();
        expect(cd.notifier.showUpload).toHaveBeenCalled();
        expect(history.replaceState)
            .toHaveBeenCalledWith({uploaded : true}, '');
      });

      it('calls the upload method and responds to negative result', function() {
        let cd = singleDocContentDelegate;
        uploadFake = function(_, _, _, callback) { callback(false); };
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

  describe('handleSingleDocumentPageCheck', function() {
    let form;
    beforeEach(function() {
      form = document.createElement('form');
      document.body.appendChild(form);
    });

    afterEach(function() { form.parentNode.removeChild(form); });

    describe('when there is NO appropriate form', function() {
      it('has no effect when the URL is wrong', function() {
        let cd = nonsenseUrlContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageCheck();
        expect(cd.recap.getAvailabilityForDocuments).not.toHaveBeenCalled();
      });

      it('has no effect with a proper URL', function() {
        let cd = singleDocContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageCheck();
        expect(cd.recap.getAvailabilityForDocuments).not.toHaveBeenCalled();
      });
    });

    describe('when there IS an appropriate form', function() {
      let input;
      beforeEach(function() {
        input = document.createElement('input');
        input.value = 'View Document';
        form.appendChild(input);

        table = document.createElement('table');
        tr = document.createElement('tr');
        td = document.createElement('td');
        td.appendChild(document.createTextNode('Image'));
        tr.appendChild(td);
        table.appendChild(tr);
        document.body.appendChild(table);
      });

      afterEach(function() {
        form.removeChild(input);
        form.innerHTML = '';
      });

      it('has no effect when the URL is wrong', function() {
        let cd = nonsenseUrlContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageCheck();
        expect(cd.recap.getAvailabilityForDocuments).not.toHaveBeenCalled();
      });

      it('checks availability for the page when the URL is right', function() {
        let cd = singleDocContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageCheck();
        expect(cd.recap.getAvailabilityForDocuments).toHaveBeenCalled();
      });

      describe('for pacer doc id 531591', function() {
        beforeEach(function() { window.pacer_doc_id = 531591; });

        afterEach(function() { delete window.pacer_doc_id });

        it('responds to a positive result', function() {
          const fakePacerDocId = 531591;
          let cd = singleDocContentDelegate;
          let fake = function (_, _, callback) {
            let response = {
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
          let banner = document.querySelector('.recap-banner');
          expect(banner).not.toBeNull();
          let link = banner.querySelector('a');
          expect(link).not.toBeNull();
          expect(link.href).toBe('https://www.courtlistener.com/download/1234');
        });
      });
    });
  });

  describe('handleSingleDocumentPageView', function() {
    let form;
    beforeEach(function() {
      form = document.createElement('form');
      document.body.appendChild(form);
    });

    afterEach(function() { form.parentNode.removeChild(form); });

    describe('when there is NO appropriate form', function() {
      it('has no effect when the URL is wrong', function() {
        let cd = nonsenseUrlContentDelegate;
        spyOn(document, 'createElement');
        cd.handleSingleDocumentPageView();
        expect(document.createElement).not.toHaveBeenCalled();
      });

      it('has no effect with a proper URL', function() {
        let cd = singleDocContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageView();
        expect(cd.recap.getAvailabilityForDocuments).not.toHaveBeenCalled();
      });
    });

    describe('when there IS an appropriate form', function() {
      let input;
      beforeEach(function() {
        input = document.createElement('input');
        input.value = 'View Document';
        form.appendChild(input);

        table = document.createElement('table');
        tr = document.createElement('tr');
        td = document.createElement('td');
        td.appendChild(document.createTextNode('Image'));
        tr.appendChild(td);
        table.appendChild(tr);
        document.body.appendChild(table);
      });

      afterEach(function() {
        form.removeChild(input);
        form.innerHTML = '';
      });

      it('creates a non-empty script element', function() {
        let cd = singleDocContentDelegate;
        let scriptSpy = {};
        spyOn(document, 'createElement').and.returnValue(scriptSpy);
        spyOn(document.body, 'appendChild');
        cd.handleSingleDocumentPageView();

        expect(document.createElement).toHaveBeenCalledWith('script');
        expect(scriptSpy.innerText).toEqual(jasmine.any(String));
        expect(document.body.appendChild).toHaveBeenCalledWith(scriptSpy);
      });

      it('adds an event listener for the message in the script', function() {
        let cd = singleDocContentDelegate;
        spyOn(window, 'addEventListener');
        cd.handleSingleDocumentPageView();

        expect(window.addEventListener)
            .toHaveBeenCalledWith('message', jasmine.any(Function), false);
      });
    });
  });

  describe('onDocumentViewSubmit', function() {
    let form;
    const form_id = '1234';
    let event = {data: {id: form_id}};

    beforeEach(function() {
      form = document.createElement('form');
      form.id = form_id;
      document.body.appendChild(form);
      let table = document.createElement('table');
      let tr_image = document.createElement('tr');
      let td_image = document.createElement('td');
      td_image.innerHTML = 'Image 1234-9876';
      tr_image.appendChild(td_image);
      table.appendChild(tr_image);
      document.body.appendChild(table);
    });

    afterEach(function() { form.parentNode.removeChild(form); });

    it('sets the onsubmit attribute of the page form', function() {
      let expected_on_submit = 'expectedOnSubmit();';
      form.setAttribute('onsubmit', expected_on_submit);
      spyOn(form, 'setAttribute');
      let cd = singleDocContentDelegate;
      cd.onDocumentViewSubmit(event);

      expect(form.setAttribute)
          .toHaveBeenCalledWith('onsubmit', 'history.forward(); return false;');
      expect(form.setAttribute)
          .toHaveBeenCalledWith('onsubmit', expected_on_submit);
    });

    it('calls showPdfPage when the response is a PDF', function() {
      let cd = singleDocContentDelegate;
      spyOn(cd, 'showPdfPage');
      cd.onDocumentViewSubmit(event);

      jasmine.Ajax.requests.mostRecent().respondWith({
        'status' : 200,
        'contentType' : 'application/pdf',
        'responseText' : pdf_data
      });
      expect(cd.showPdfPage).toHaveBeenCalled();
    });

    it('calls showPdfPage when the response is HTML', function() {
      let cd = singleDocContentDelegate;
      let fakeOnLoad = jasmine.createSpy();
      let fakeFileReader = {
        readAsText: function () {
          this.result = '<html></html>';
          this.onload();
        }
      };
      spyOn(window, 'FileReader')
          .and.callFake(function() { return fakeFileReader; });
      spyOn(cd, 'showPdfPage');
      cd.onDocumentViewSubmit(event);

      jasmine.Ajax.requests.mostRecent().respondWith({
        'status' : 200,
        'contentType' : 'text/html',
        'responseText' : '<html></html>'
      });
      expect(cd.showPdfPage).toHaveBeenCalled();
    });
  });

  describe('showPdfPage', function() {
    const pre = ('<head><style>body { margin: 0; } iframe { border: none; }' +
        '</style></head><body>');
    const iframe = '<iframe src="data:pdf"';
    const post = ' width="100%" height="100%"></iframe></body>';
    let html = pre + iframe + post;
    let cd = singleDocContentDelegate;
    let documentElement;

    beforeEach(function() {
      documentElement = jasmine.createSpy();
      cd.showPdfPage(documentElement, html, '');
    });

    it('correctly extracts the data before and after the iframe', function() {
      let waiting = '<p>Waiting for download...<p>';
      let expected_iframe = '<iframe src="about:blank"';
      expect(documentElement.innerHTML)
          .toBe(pre + waiting + expected_iframe + post);
    });

    describe('when it downloads the PDF in the iframe', function() {
      const docid = '127015406472';
      const casenum = '437098';
      const docnum = '4';
      const subdocnum = '0';

      beforeEach(function() {
        let fakeGet = function (_, callback) {
          callback(casenum);
        };
        let fakeUpload = function (_, _, _, _, _, _,
                                   callback) {
          callback(true);
        };

        spyOn(cd.recap, 'getPacerCaseIdFromPacerDocId').and.callFake(fakeGet);
        spyOn(cd.recap, 'uploadDocument').and.callFake(fakeUpload);
        spyOn(cd.notifier, 'showUpload');
        spyOn(URL, 'createObjectURL').and.returnValue('data:blob');
        spyOn(history, 'pushState');
        spyOn(window, 'saveAs');
        jasmine.Ajax.requests.mostRecent().respondWith({
          'status' : 200,
          'contentType' : 'application/pdf',
          'responseText' : pdf_data
        });
      });

      it('makes the back button redisplay the previous page', function() {
        expect(window.onpopstate).toEqual(jasmine.any(Function));
        window.onpopstate({state : {content : 'previous'}});
        expect(documentElement.innerHTML).toBe('previous');
      });

      it('displays the page with the downloaded file in an iframe', function() {
        if ((navigator.userAgent.indexOf('Chrome') >= 0) &&
            !navigator.plugins.namedItem('Chrome PDF Viewer')) {
          // isExternalPdf, file is saved with saveAs
          expect(documentElement.innerHTML)
              .toMatch(/<iframe.*?src="about:blank".*?><\/iframe>/);
          expect(window.saveAs).toHaveBeenCalled();
        } else {
          expect(documentElement.innerHTML)
              .toMatch(/<iframe.*?src="data:blob".*?><\/iframe>/);
        }
      });

      it('puts the generated HTML in the page history', function() {
        if ((navigator.userAgent.indexOf('Chrome') >= 0) &&
            !navigator.plugins.namedItem('Chrome PDF Viewer')) {
          // isExternalPdf, file is saved with saveAs
          expect(history.pushState).not.toHaveBeenCalled();
          expect(window.saveAs).toHaveBeenCalled();
        } else {
          expect(history.pushState).toHaveBeenCalled();
        }
      });

      it('uploads the PDF to RECAP',
         function() { expect(cd.recap.uploadDocument).toHaveBeenCalled(); });

      it('calls the notifier once the upload finishes',
         function() { expect(cd.notifier.showUpload).toHaveBeenCalled(); });
    });
  });

  function linksFromUrls(urls) {
    let links = [];
    for (let i = 0; i < urls.length; i++) {
      let link = document.createElement('a');
      link.href = urls[i];
      if (i === 0) {
        link.dataset.pacer_doc_id = 1234;
      }
      links.push(link);
    }
    return links;
  }

  // TODO: Add tests for findAndStorePacerDocIds

  // TODO: Figure out where the functionality of
  // 'addMouseoverToConvertibleLinks' went, and add tests for that.

  describe('handleRecapLinkClick', function() {
    let cd = docketDisplayContentDelegate;
    let linkUrl = singleDocUrl;

    afterEach(function() { delete window.chrome; });

    describe('when the popup option is not set', function() {
      beforeEach(function() {
        window.chrome = {
          storage : {
            local : {
              get : jasmine.createSpy().and.callFake(function(
                  _, cb) { cb({options : {}}); })
            }
          }
        };
      });

      it('redirects to the link url immediately', function() {
        let window_obj = {};
        cd.handleRecapLinkClick(window_obj, linkUrl);
        expect(window_obj.location).toBe(linkUrl);
      });
    });

    describe('when the popup option is set', function() {
      beforeEach(function() {
        window.chrome = {
          storage : {
            local : {
              get : jasmine.createSpy().and.callFake(function(
                  _, cb) { cb({options : {recap_link_popups : true}}); })
            }
          }
        };
      });

      it('attaches the RECAP popup', function() {
        cd.handleRecapLinkClick({}, linkUrl);
        expect($('#recap-shade').length).not.toBe(0);
        expect($('.recap-popup').length).not.toBe(0);

        let foundLink = false;
        $('.recap-popup a').each(function(i, link) {
          if (link.href === linkUrl) {
            foundLink = true;
          }
        });
        expect(foundLink).toBe(true);
      });
    });
  });

  describe('attachRecapLinkToEligibleDocs', function() {
    const fake_urls = ['http://foo.fake/bar/0', 'http://foo.fake/bar/1'];

    const urls = [
      'https://ecf.canb.uscourts.gov/doc1/034031424909',
      'https://ecf.canb.uscourts.gov/doc1/034031438754'
    ];

    describe('when there are no valid urls', function() {
      let links;
      let cd;
      beforeEach(function() {
        links = linksFromUrls(fake_urls);
        cd = new ContentDelegate(null, null, null, null, null, links);
        cd.attachRecapLinkToEligibleDocs();
      });

      it('does nothing', function() {
        expect(jasmine.Ajax.requests.mostRecent()).toBeUndefined();
      });
    });

    describe('when there are valid urls', function() {
      let links;
      let cd;
      beforeEach(function() {
        links = linksFromUrls(urls);
        $('body').append(links);
        cd = new ContentDelegate(null, null, null, null, null, links);
        cd.pacer_doc_ids = [ 1234 ];
      });

      it('does not attach any links if no urls have recap', function() {
        spyOn(cd.recap, 'getAvailabilityForDocuments')
            .and.callFake(function(_, _, callback) {
              callback({
                results : [],
              });
            });
        cd.attachRecapLinkToEligibleDocs();
        expect($('.recap-inline').length).toBe(0);
      });

      it('attaches a single link to the one url with recap', function() {
        spyOn(cd.recap, 'getAvailabilityForDocuments')
            .and.callFake(function(_, _, callback) {
              callback({
                results :
                    [ {pacer_doc_id : 1234, filepath_local : 'download/1234'} ],
              });
            });
        cd.attachRecapLinkToEligibleDocs();
        expect($('.recap-inline').length).toBe(1);
      });

      it('attaches a working click handler', function() {
        spyOn(cd, 'handleRecapLinkClick');
        spyOn(cd.recap, 'getAvailabilityForDocuments')
            .and.callFake(function(_, _, callback) {
              callback({
                results :
                    [ {pacer_doc_id : 1234, filepath_local : 'download/1234'} ],
              });
            });
        cd.attachRecapLinkToEligibleDocs();
        $(links[0]).next().click();
        expect(cd.handleRecapLinkClick).toHaveBeenCalled();
      });
    });
  });
});
