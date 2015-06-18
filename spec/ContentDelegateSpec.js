describe('The ContentDelegate class', function() {
  var docketQueryUrl = 'https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?531591';
  var docketDisplayUrl = ('https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?' +
                          '101092135737069-L_1_0-1');
  var docketDisplayPath = '/cgi-bin/DktRpt.pl?101092135737069-L_1_0-1';
  var singleDocUrl = 'https://ecf.canb.uscourts.gov/doc1/034031424909';
  var nonsenseUrl = 'http://something.uscourts.gov/foobar/baz';

  function setupChromeSpy() {
    window.chrome = {
      extension: {
        getURL: jasmine.createSpy()
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


  it('gets created with a url, path, court and casenum', function() {
    var expected_url = 'https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?531591';
    var expected_path = '/cgi-bin/DktRpt.pl?531591';
    var expected_court = 'canb';
    var expected_casenum = '531591';

    var cd = new ContentDelegate(
      expected_url, expected_path, expected_court, expected_casenum);
    expect(cd.url).toBe(expected_url);
    expect(cd.path).toBe(expected_path);
    expect(cd.court).toBe(expected_court);
    expect(cd.casenum).toBe(expected_casenum);
  });

  describe('handleDocketQueryUrl', function() {
    beforeEach(function() {
      var form = document.createElement('form');
      document.body.appendChild(form);
    });

    afterEach(function() {
      var form = document.getElementsByTagName('FORM')[0];
      form.parentNode.removeChild(form);
    });

    it('has no effect when not on a docket query url', function() {
      var cd = new ContentDelegate(nonsenseUrl, null, null);
      spyOn(cd.recap, 'getAvailabilityForDocket');
      cd.handleDocketQueryUrl();
      expect(cd.recap.getAvailabilityForDocket).not.toHaveBeenCalled();
    });

    it('inserts the RECAP banner on an appropriate page', function() {
      var cd = new ContentDelegate(docketQueryUrl, 'canb', '531591');
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
      var cd = new ContentDelegate(docketQueryUrl, 'canb', '531591');
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
      var cd = new ContentDelegate(nonsenseUrl, null, null);
      spyOn(cd.recap, 'uploadDocket');
      cd.handleDocketDisplayPage();
      expect(cd.recap.uploadDocket).not.toHaveBeenCalled();
    });

    it('has no effect when there is no casenum', function() {
      var cd = new ContentDelegate(docketDisplayUrl, null, null);
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
        var cd = new ContentDelegate(docketDisplayUrl, 'canb', '531591');
        spyOn(cd.recap, 'uploadDocket');
        cd.handleDocketDisplayPage();
        expect(cd.recap.uploadDocket).not.toHaveBeenCalled();
      });
    });

    it('calls uploadDocket and responds to a positive result', function() {
      var cd = new ContentDelegate(docketDisplayUrl, docketDisplayPath,
                                   'canb', '531591');
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
      var cd = new ContentDelegate(docketDisplayUrl, docketDisplayPath,
                                   'canb', '531591');
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
        var cd = new ContentDelegate(nonsenseUrl, null, null);
        spyOn(cd.recap, 'uploadAttachmentMenu');
        cd.handleAttachmentMenuPage();
        expect(cd.recap.uploadAttachmentMenu).not.toHaveBeenCalled();
      });

      it('has no effect with a proper URL', function() {
        var cd = new ContentDelegate(singleDocUrl, 'canb', '531591');
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
        var cd = new ContentDelegate(nonsenseUrl, null, null);
        spyOn(cd.recap, 'uploadAttachmentMenu');
        cd.handleAttachmentMenuPage();
        expect(cd.recap.uploadAttachmentMenu).not.toHaveBeenCalled();
      });

      it('uploads the page when the URL is right', function() {
        var cd = new ContentDelegate(singleDocUrl, 'canb', '531591');
        spyOn(cd.recap, 'uploadAttachmentMenu');
        cd.handleAttachmentMenuPage();
        expect(cd.recap.uploadAttachmentMenu).toHaveBeenCalled();
      });

      it('calls the upload method and responds to positive result', function() {
        var cd = new ContentDelegate(singleDocUrl, 'canb', '531591');
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
        var cd = new ContentDelegate(singleDocUrl, 'canb', '531591');
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
        var cd = new ContentDelegate(nonsenseUrl, null, null);
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageCheck();
        expect(cd.recap.getAvailabilityForDocuments).not.toHaveBeenCalled();
      });

      it('has no effect with a proper URL', function() {
        var cd = new ContentDelegate(singleDocUrl, 'canb', '531591');
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
        var cd = new ContentDelegate(nonsenseUrl, null, null);
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageCheck();
        expect(cd.recap.getAvailabilityForDocuments).not.toHaveBeenCalled();
      });

      it('checks availability for the page when the URL is right', function() {
        var cd = new ContentDelegate(singleDocUrl, 'canb', '531591');
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageCheck();
        expect(cd.recap.getAvailabilityForDocuments).toHaveBeenCalled();
      });

      it('responds to a positive result', function() {
        var fakeDownloadUrl = 'http://download.fake/531591';
        var cd = new ContentDelegate(singleDocUrl, 'canb', '531591');
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
});
