describe('The ContentDelegate class', function() {
  var docketQueryUrl = 'https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?531591';
  var docketQueryPath = '/cgi-bin/DktRpt.pl?531591';
  var docketDisplayUrl = ('https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?' +
                          '101092135737069-L_1_0-1');
  var docketDisplayPath = '/cgi-bin/DktRpt.pl?101092135737069-L_1_0-1';
  var singleDocUrl = 'https://ecf.canb.uscourts.gov/doc1/034031424909';
  var singleDocPath = '/doc1/034031424909';
  var nonsenseUrl = 'http://something.uscourts.gov/foobar/baz';
  // Smallest possible PDF according to:
  // http://stackoverflow.com/questions/17279712/what-is-the-smallest-possible-valid-pdf
  var pdf_data = ('%PDF-1.\ntrailer<</Root<</Pages<</Kids' +
                  '[<</MediaBox[0 0 3 3]>>]>>>>>>\n');

  var nonsenseUrlContentDelegate = new ContentDelegate(nonsenseUrl);
  var docketQueryContentDelegate = new ContentDelegate(
    docketQueryUrl, docketQueryPath, 'canb', '531591', []);
  var docketDisplayContentDelegate =  new ContentDelegate(
    docketDisplayUrl, docketDisplayPath, 'canb', '531591', []);
  var singleDocContentDelegate = new ContentDelegate(
    singleDocUrl, singleDocPath, 'canb', '531591', []);

  function setupChromeSpy() {
    window.chrome = {
      extension: {
        getURL: jasmine.createSpy()
      },
      storage: {
        sync: {
          get: jasmine.createSpy()
        }
      }
    }
  }

  function removeChromeSpy() {
    delete window.chrome;
  }

  beforeEach(function() {
    jasmine.Ajax.install();
    setupChromeSpy();
  });

  afterEach(function() {
    jasmine.Ajax.uninstall();
    removeChromeSpy();
  });


  it('gets created with necessary arguments', function() {
    var expected_url = 'https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?531591';
    var expected_path = '/cgi-bin/DktRpt.pl?531591';
    var expected_court = 'canb';
    var expected_casenum = '531591';
    var expected_docid = '127015406472';
    var link_0 = document.createElement('a');
    link_0.href = 'http://foo/bar/0'
    var link_1 = document.createElement('a');
    link_1.href = 'http://foo/bar/1'
    var expected_links = [link_0, link_1];


    var cd = new ContentDelegate(
      expected_url, expected_path, expected_court, expected_casenum,
      expected_docid, expected_links);
    expect(cd.url).toBe(expected_url);
    expect(cd.path).toBe(expected_path);
    expect(cd.court).toBe(expected_court);
    expect(cd.casenum).toBe(expected_casenum);
    expect(cd.docid).toBe(expected_docid);
    expect(cd.links).toEqual(expected_links);
  });

  describe('handleDocketQueryUrl', function() {
    var form;
    beforeEach(function() {
      form = document.createElement('form');
      document.body.appendChild(form);
    });

    afterEach(function() {
      form.parentNode.removeChild(form);
    });

    it('has no effect when not on a docket query url', function() {
      var cd = nonsenseUrlContentDelegate;
      spyOn(cd.recap, 'getAvailabilityForDocket');
      cd.handleDocketQueryUrl();
      expect(cd.recap.getAvailabilityForDocket).not.toHaveBeenCalled();
    });

    it('inserts the RECAP banner on an appropriate page', function() {
      var cd = docketQueryContentDelegate;
      cd.handleDocketQueryUrl();
      jasmine.Ajax.requests.mostRecent().respondWith({
        'status': 200,
        'contentType': 'application/json',
        'responseText': ('{"timestamp": "04\/16\/15", "docket_url": ' +
                         '"http:\/\/www.archive.org\/download\/gov.uscourts.' +
                         'canb.531591\/gov.uscourts.canb.531591.docket.html"}')
      });
      var banner = document.querySelector('.recap-banner');
      expect(banner).not.toBeNull();
      expect(banner.innerHTML).toContain('04/16/15');
      var link = banner.querySelector('a');
      expect(link).not.toBeNull();
      expect(link.href).toBe('http://www.archive.org/download/gov.uscourts.' +
                             'canb.531591/gov.uscourts.canb.531591.docket.html')
    });

    it('has no effect when on a docket query that has no RECAP', function() {
      var cd = docketQueryContentDelegate;
      cd.handleDocketQueryUrl();
      jasmine.Ajax.requests.mostRecent().respondWith({
        'status': 200,
        'contentType': 'application/json',
        'responseText': '{}'
      });
      var banner = document.querySelector('.recap-banner');
      expect(banner).toBeNull();
    });
  });

  describe('handleDocketDisplayPage', function() {
    it('has no effect when not on a docket display url', function() {
      var cd = nonsenseUrlContentDelegate;
      spyOn(cd.recap, 'uploadDocket');
      cd.handleDocketDisplayPage();
      expect(cd.recap.uploadDocket).not.toHaveBeenCalled();
    });

    it('has no effect when there is no casenum', function() {
      var cd = new ContentDelegate(docketDisplayUrl);
      spyOn(cd.recap, 'uploadDocket');
      cd.handleDocketDisplayPage();
      expect(cd.recap.uploadDocket).not.toHaveBeenCalled();
    });

    describe('when the history state is already set', function() {
      beforeEach(function() {
        history.state = { uploaded: true };
      });

      afterEach(function() {
        history.state = {};
      });

      it('has no effect', function() {
        var cd = docketDisplayContentDelegate;
        spyOn(cd.recap, 'uploadDocket');
        cd.handleDocketDisplayPage();
        expect(cd.recap.uploadDocket).not.toHaveBeenCalled();
      });
    });

    it('calls uploadDocket and responds to a positive result', function() {
      var cd = docketDisplayContentDelegate;
      spyOn(cd.notifier, 'showUpload');
      spyOn(cd.recap, 'uploadDocket').and.callFake(function(_, _, _, _, _, cb) {
        cb(true);
      });
      spyOn(history, 'replaceState');

      cd.handleDocketDisplayPage();
      expect(cd.recap.uploadDocket).toHaveBeenCalled();
      expect(cd.notifier.showUpload).toHaveBeenCalled();
      expect(history.replaceState).toHaveBeenCalledWith({uploaded: true}, '');
    });

    it('calls uploadDocket and responds to a negative result', function() {
      var cd = docketDisplayContentDelegate;
      spyOn(cd.notifier, 'showUpload');
      spyOn(cd.recap, 'uploadDocket').and.callFake(function(_, _, _, _, _, cb) {
        cb(false);
      });
      spyOn(history, 'replaceState');

      cd.handleDocketDisplayPage();
      expect(cd.recap.uploadDocket).toHaveBeenCalled();
      expect(cd.notifier.showUpload).not.toHaveBeenCalled();
      expect(history.replaceState).not.toHaveBeenCalled();
    });
  });

  describe('handleAttachmentMenuPage', function() {
    var form;
    beforeEach(function() {
      form = document.createElement('form');
      document.body.appendChild(form);
    });

    afterEach(function() {
      form.parentNode.removeChild(form);
    });

    describe('when there is NO appropriate form', function() {
      it('has no effect when the URL is wrong', function() {
        var cd = nonsenseUrlContentDelegate;
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
      var input;
      beforeEach(function() {
        input = document.createElement('input');
        input.value = 'Download All';
        form.appendChild(input);
      });

      afterEach(function() {
        form.removeChild(input);
      });

      it('has no effect when the URL is wrong', function() {
        var cd = nonsenseUrlContentDelegate;
        spyOn(cd.recap, 'uploadAttachmentMenu');
        cd.handleAttachmentMenuPage();
        expect(cd.recap.uploadAttachmentMenu).not.toHaveBeenCalled();
      });

      it('uploads the page when the URL is right', function() {
        var cd = singleDocContentDelegate;
        spyOn(cd.recap, 'uploadAttachmentMenu');
        cd.handleAttachmentMenuPage();
        expect(cd.recap.uploadAttachmentMenu).toHaveBeenCalled();
      });

      it('calls the upload method and responds to positive result', function() {
        var cd = singleDocContentDelegate;
        uploadFake = function(_, _, _, _, callback) {
          callback(true);
        };
        spyOn(cd.recap, 'uploadAttachmentMenu').and.callFake(uploadFake);
        spyOn(cd.notifier, 'showUpload');
        spyOn(history, 'replaceState');

        cd.handleAttachmentMenuPage();
        expect(cd.recap.uploadAttachmentMenu).toHaveBeenCalled();
        expect(cd.notifier.showUpload).toHaveBeenCalled();
        expect(history.replaceState).toHaveBeenCalledWith({uploaded: true}, '');
      });

      it('calls the upload method and responds to negative result', function() {
        var cd = singleDocContentDelegate;
        uploadFake = function(_, _, _, _, callback) {
          callback(false);
        };
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
    var form;
    beforeEach(function() {
      form = document.createElement('form');
      document.body.appendChild(form);
    });

    afterEach(function() {
      form.parentNode.removeChild(form);
    });

    describe('when there is NO appropriate form', function() {
      it('has no effect when the URL is wrong', function() {
        var cd = nonsenseUrlContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageCheck();
        expect(cd.recap.getAvailabilityForDocuments).not.toHaveBeenCalled();
      });

      it('has no effect with a proper URL', function() {
        var cd = singleDocContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageCheck();
        expect(cd.recap.getAvailabilityForDocuments).not.toHaveBeenCalled();
      });
    });

    describe('when there IS an appropriate form', function() {
      var input;
      beforeEach(function() {
        input = document.createElement('input');
        input.value = 'View Document';
        form.appendChild(input);
      });

      afterEach(function() {
        form.removeChild(input);
        form.innerHTML = '';
      });

      it('has no effect when the URL is wrong', function() {
        var cd = nonsenseUrlContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageCheck();
        expect(cd.recap.getAvailabilityForDocuments).not.toHaveBeenCalled();
      });

      it('checks availability for the page when the URL is right', function() {
        var cd = singleDocContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageCheck();
        expect(cd.recap.getAvailabilityForDocuments).toHaveBeenCalled();
      });

      it('responds to a positive result', function() {
        var fakeDownloadUrl = 'http://download.fake/531591';
        var cd = singleDocContentDelegate;
        var fake = function(_, callback) {
          var response = {};
          response[singleDocUrl] = {filename: fakeDownloadUrl};
          callback(response);
        };
        spyOn(cd.recap, 'getAvailabilityForDocuments').and.callFake(fake);

        cd.handleSingleDocumentPageCheck();

        expect(cd.recap.getAvailabilityForDocuments).toHaveBeenCalled();
        var banner = document.querySelector('.recap-banner');
        expect(banner).not.toBeNull();
        var link = banner.querySelector('a');
        expect(link).not.toBeNull();
        expect(link.href).toBe(fakeDownloadUrl);
      });
    });
  });

  describe('handleSingleDocumentPageView', function() {
    var form;
    beforeEach(function() {
      form = document.createElement('form');
      document.body.appendChild(form);
    });

    afterEach(function() {
      form.parentNode.removeChild(form);
    });

    describe('when there is NO appropriate form', function() {
      it('has no effect when the URL is wrong', function() {
        var cd = nonsenseUrlContentDelegate;
        spyOn(document, 'createElement');
        cd.handleSingleDocumentPageView();
        expect(document.createElement).not.toHaveBeenCalled();
      });

      it('has no effect with a proper URL', function() {
        var cd = singleDocContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageView();
        expect(cd.recap.getAvailabilityForDocuments).not.toHaveBeenCalled();
      });
    });

    describe('when there IS an appropriate form', function() {
      var input;
      beforeEach(function() {
        input = document.createElement('input');
        input.value = 'View Document';
        form.appendChild(input);
      });

      afterEach(function() {
        form.removeChild(input);
        form.innerHTML = '';
      });

      it('creates a non-empty script element', function() {
        var cd = singleDocContentDelegate;
        var scriptSpy = {};
        spyOn(document, 'createElement').and.returnValue(scriptSpy);
        spyOn(document.body, 'appendChild');
        cd.handleSingleDocumentPageView();

        expect(document.createElement).toHaveBeenCalledWith('script');
        expect(scriptSpy.innerText).toEqual(jasmine.any(String));
        expect(document.body.appendChild).toHaveBeenCalledWith(scriptSpy);
      });

      it('adds an event listener for the message in the script', function() {
        var cd = singleDocContentDelegate;
        spyOn(window, 'addEventListener');
        cd.handleSingleDocumentPageView();

        expect(window.addEventListener).toHaveBeenCalledWith(
          'message', jasmine.any(Function), false);
      });
    });
  });

  describe('onDocumentViewSubmit', function() {
    var form;
    var form_id = '1234';
    var event = {data: {id: form_id}};

    beforeEach(function() {
      form = document.createElement('form');
      form.id = form_id;
      document.body.appendChild(form);
    });

    afterEach(function() {
      form.parentNode.removeChild(form);
    });

    it('sets the onsubmit attribute of the page form', function() {
      var expected_on_submit = 'expectedOnSubmit();';
      form.setAttribute('onsubmit', expected_on_submit);
      spyOn(form, 'setAttribute');
      var cd = singleDocContentDelegate;
      cd.onDocumentViewSubmit(event);

      expect(form.setAttribute).toHaveBeenCalledWith(
        'onsubmit', 'history.forward(); return false;');
      expect(form.setAttribute).toHaveBeenCalledWith(
        'onsubmit', expected_on_submit);
    });


    it('calls showPdfPage when the response is a PDF', function() {
      var cd = singleDocContentDelegate;
      spyOn(cd, 'showPdfPage');
      cd.onDocumentViewSubmit(event);

      jasmine.Ajax.requests.mostRecent().respondWith({
        'status': 200,
        'contentType': 'application/pdf',
        'responseText': pdf_data
      });
      expect(cd.showPdfPage).toHaveBeenCalled();
    });

    it('calls showPdfPage when the response is HTML', function() {
      var cd = singleDocContentDelegate;
      var fakeOnLoad = jasmine.createSpy();
      var fakeFileReader = {
          readAsText: function() {
            this.result = '<html></html>';
            this.onload();
          }
      };
      spyOn(window, 'FileReader').and.callFake(function() {
        return fakeFileReader;
      });
      spyOn(cd, 'showPdfPage');
      cd.onDocumentViewSubmit(event);

      jasmine.Ajax.requests.mostRecent().respondWith({
        'status': 200,
        'contentType': 'text/html',
        'responseText': '<html></html>'
      });
      expect(cd.showPdfPage).toHaveBeenCalled();
    });
  });

  describe('showPdfPage', function() {
    var pre = ('<head><style>body { margin: 0; } iframe { border: none; }' +
               '</style></head><body>');
    var iframe = '<iframe src="data:pdf"';
    var post = ' width="100%" height="100%"></iframe></body>';
    var html = pre + iframe + post;
    var cd = singleDocContentDelegate;
    var documentElement;

    beforeEach(function() {
      documentElement = jasmine.createSpy();
      cd.showPdfPage(documentElement, html, '');
    });

    it('correctly extracts the data before and after the iframe', function() {
      var expected_iframe = '<iframe src="about:blank"';
      expect(documentElement.innerHTML).toBe(pre + expected_iframe + post);
    });

    describe('when it downloads the PDF in the iframe', function() {
      var docid = '127015406472';
      var casenum = '437098';
      var docnum = '4';
      var subdocnum = '0';

      beforeEach(function() {
        var fakeGet = function(_, callback) {
          callback(docid, casenum, docnum, subdocnum);
        };
        var fakeUpload = function(_, _, _, _, _, callback) {
          callback(true);
        };
        spyOn(cd.recap, 'getDocumentMetadata').and.callFake(fakeGet);
        spyOn(cd.recap, 'uploadDocument').and.callFake(fakeUpload);
        spyOn(cd.notifier, 'showUpload');
        spyOn(URL, 'createObjectURL').and.returnValue('data:blob');
        spyOn(history, 'pushState');
        jasmine.Ajax.requests.mostRecent().respondWith({
          'status': 200,
          'contentType': 'application/pdf',
          'responseText': pdf_data
        });
      });

      it('makes the back button redisplay the previous page', function() {
        expect(window.onpopstate).toEqual(jasmine.any(Function));
        window.onpopstate({state: {content: 'previous'}});
        expect(documentElement.innerHTML).toBe('previous');
      });

      it('displays the page with the downloaded file in an iframe', function() {
        expect(documentElement.innerHTML).toMatch(
            /<iframe.*?src="data:blob".*?><\/iframe>/);
      });

      it('puts the generated HTML in the page history', function() {
        expect(history.pushState).toHaveBeenCalled();
      });

      it('uploads the PDF to RECAP', function() {
        expect(cd.recap.uploadDocument).toHaveBeenCalled();
      });

      it('calls the notifier once the upload finishes', function() {
        expect(cd.notifier.showUpload).toHaveBeenCalled();
      });
    });
  });


  function linksFromUrls(urls) {
    var links = []
    for (var i=0; i<urls.length; i++) {
      var link = document.createElement('a');
      link.href = urls[i];
      links.push(link);
    }
    return links;
  }


  describe('find doc URLs', function() {
    var valid_doc_urls = [
      'https://ecf.canb.uscourts.gov/doc1/034031424909',
      'https://ecf.canb.uscourts.gov/doc1/034031425808'
    ];

    var invalid_doc_urls = [
      'https://foo.bar.canb.uscourts.gov/some/path',
      'https://ecf.canb.uscourts.gov/some/path'
    ];
    var doc_urls = valid_doc_urls.concat(invalid_doc_urls);
    var links = linksFromUrls(doc_urls);

    var cd = null;
    beforeEach(function() {
      cd = new ContentDelegate(null, null, null, null, null, links);
    });

    it('finds the actual document URLs', function() {
      expect(cd.urls).toEqual(valid_doc_urls);
    });
  });

  describe('addMouseoverToConvertibleLinks', function() {
    var convertible_doc_url = ('https://ecf.nysd.uscourts.gov/cgi-bin/' + 
                               'show_doc.pl?caseid=427118&de_seq_num=34' +
                               '&dm_id=13165146&doc_num=6');
    var nonconvertible_url = 'https://ecf.canb.uscourts.gov/doc1/034031424909';

    function dispatchMouseoverOn(elem) {
      var event = document.createEvent('MouseEvents');
      event.initMouseEvent('mouseover', true, true, null)
      elem.dispatchEvent(event);
    }

    var links;
    var cd;
    beforeEach(function() {
      links = linksFromUrls([convertible_doc_url, nonconvertible_url]);
      cd = new ContentDelegate(null, null, null, null, null, links);
      cd.addMouseoverToConvertibleLinks();
    });

    it('adds a mouseover function to a convertible doc link', function() {
      spyOn(cd.pacer, 'convertDocumentUrl');
      dispatchMouseoverOn(links[0]);
      expect(cd.pacer.convertDocumentUrl).toHaveBeenCalled();
    });

    it('does not add a mouseover function to the wrong link', function() {
      spyOn(cd.pacer, 'convertDocumentUrl');
      dispatchMouseoverOn(links[1]);
      expect(cd.pacer.convertDocumentUrl).not.toHaveBeenCalled();
    });

    it('handler does not trigger after url changes', function() {
      spyOn(cd.pacer, 'convertDocumentUrl');
      links[0].href = 'http://foo/bar';
      dispatchMouseoverOn(links[0]);
      expect(cd.pacer.convertDocumentUrl).not.toHaveBeenCalled();      
    });

    it('calls uploadMetadata after converting the url', function() {
      spyOn(cd.recap, 'uploadMetadata');
      dispatchMouseoverOn(links[0]);
      jasmine.Ajax.requests.mostRecent().respondWith({
        'status': 200,
        'contentType': 'text/html',
        'responseText': nonconvertible_url
      });
      expect(cd.recap.uploadMetadata).toHaveBeenCalled();
    });
  });

  describe('handleRecapLinkClick', function() {
    var cd = docketDisplayContentDelegate;
    var linkUrl = singleDocUrl;

    afterEach(function() {
      delete window.chrome;
    });

    describe('when the popup option is not set', function() {
      beforeEach(function() {
        window.chrome =  {
          storage: {
            sync: {
              get: jasmine.createSpy().and.callFake(function(_, cb) {
                 cb({options: {}});
              })
            }
          }
        };
      });

      it('redirects to the link url immediately', function() {
        var window_obj = {};
        cd.handleRecapLinkClick(window_obj, linkUrl);
        expect(window_obj.location).toBe(linkUrl);
      });
    });
    
    describe('when the popup option is set', function() {
      beforeEach(function() {
        window.chrome =  {
          storage: {
            sync: {
              get: jasmine.createSpy().and.callFake(function(_, cb) {
                 cb({options: {recap_link_popups: true}});
              })
            }
          }
        };
      });

      it('attaches the RECAP popup', function() {
        cd.handleRecapLinkClick({}, linkUrl);
        expect($('#recap-shade').length).not.toBe(0);
        expect($('.recap-popup').length).not.toBe(0);

        var foundLink = false;
        $('.recap-popup a').each(function(i, link) {
          if (link.href == linkUrl) {
            foundLink = true;
          }
        });
        expect(foundLink).toBe(true);
      });
    });
  });

  describe('attachRecapLinkToEligibleDocs', function() {
    var fake_urls = [
      'http://foo.fake/bar/0',
      'http://foo.fake/bar/1'
    ];

    var urls = [
      'https://ecf.canb.uscourts.gov/doc1/034031424909',
      'https://ecf.canb.uscourts.gov/doc1/034031438754',
    ]

    describe('when there are no valid urls', function() {
      var links;
      var cd;
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
      var links;
      var cd;
      beforeEach(function() {
        links = linksFromUrls(urls);
        $('body').append(links);
        cd = new ContentDelegate(null, null, null, null, null, links);
        cd.attachRecapLinkToEligibleDocs();
      });

      it('does not attach any links if no urls have recap', function() {
        jasmine.Ajax.requests.mostRecent().respondWith({
          'status': 200,
          'contentType': 'application/json',
          'responseText': "{}"
        });
        expect($('.recap-inline').length).toBe(0);
      });

      var resp = {}
      resp[urls[0]] = {
        'filename': 'foo.pdf',
        'timestamp': 'July 4, 2015',
      };
      it('attaches a single link to the one url with recap', function() {
        jasmine.Ajax.requests.mostRecent().respondWith({
          'status': 200,
          'contentType': 'application/json',
          'responseText': JSON.stringify(resp)
        });
        expect($('.recap-inline').length).toBe(1);
      });

      it('attaches a working click handler', function() {
        spyOn(cd, 'handleRecapLinkClick');
        jasmine.Ajax.requests.mostRecent().respondWith({
          'status': 200,
          'contentType': 'application/json',
          'responseText': JSON.stringify(resp)
        });
        $('.recap-inline').click()
        expect(cd.handleRecapLinkClick).toHaveBeenCalled();
      });
    });
  });
});
