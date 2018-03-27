describe('The Recap export module', function() {
  var recap = Recap();

  var docUrls = [
    'https://ecf.canb.uscourts.gov/doc1/034031424909',
    'https://ecf.canb.uscourts.gov/doc1/034031425808',
    'https://ecf.canb.uscourts.gov/doc1/034031438754'
  ];
  var court = 'nysd';
  var pacer_doc_id = '127015406472';
  var pacer_case_id = '437098';
  var de_seq_num = '70';
  var dm_id = '14114895';
  var docnum = '4';
  var attachnum = '1';
  var offCaseNum = '12344321';
  var subdocnum = '0';
  var filename = 'DktRpt.html';
  var type = 'text/html';
  var html = '<html></html>';

  var FormDataFake = function() { };
  FormDataFake.prototype.append = function(key, value) {
    this[key] = value;
  };
  var FormDataConstructor = function() {
    return new FormDataFake();
  }

  beforeEach(function() {
    jasmine.Ajax.install();
    jasmine.Ajax.addCustomParamParser({
      // This custom parser simply echos back the params, used for fake
      // FormData objects.
      test: function(xhr) {
        // The params are a plain object with a court property.
        if (xhr.params instanceof Object) {
          return ('court' in xhr.params)
        }
        return false;
      },
      parse: function(formData) {
        return formData;
      }
    });
  });

  afterEach(function() {
    jasmine.Ajax.uninstall();
  });

  function setupChromeSpy() {
    window.chrome = {
      storage: {
        local: {
          get: jasmine.createSpy()
        }
      }
    }
  }
  
  function removeChromeSpy() {
    delete window.chrome;
  }

  function setupMetadataResponse(msg) {
    var caseObj = {};
    var docObj = {};
    caseObj[pacer_doc_id] = {'pacer_doc_id': pacer_doc_id, 'officialcasenum': offCaseNum};
    docObj[docid] = {'pacer_doc_id': pacer_doc_id, 'officialcasenum': offCaseNum,
                     'docnum': docnum, 'subdocnum': subdocnum};
    return {'documents': docObj, 'cases': caseObj, 'message': msg};
  }

  function expectMetadata(actCasenum, actOff, actDocnum, actSubdocnum) {
    expect(actCasenum).toBe(pacer_doc_id);
    expect(actOff).toBe(offCaseNum);
    expect(actDocnum).toBe(docnum);
    expect(actSubdocnum).toBe(subdocnum);
  }

  describe('getAvailabilityForDocket', function() {
    it('requests the correct URL', function() {
      recap.getAvailabilityForDocket();
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://www.courtlistener.com/api/rest/v3/dockets/?fields=absolute_url%2Cdate_modified');
    });

    it('encodes the court and caseId in the GET params', function() {
      var expectedCourt = 'canb';
      var expectedCaseId = '531316';
      recap.getAvailabilityForDocket(expectedCourt, expectedCaseId);
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://www.courtlistener.com/api/rest/v3/dockets/' +
          '?pacer_case_id=531316&court=canb&' +
          'fields=absolute_url%2Cdate_modified');
    });

    it('calls the callback with the parsed server response', function() {
      var callback = jasmine.createSpy();
      var expectedCourt = 'canb';
      var expectedCaseNum = '531316';
      recap.getAvailabilityForDocket(expectedCourt, expectedCaseNum, callback);
      jasmine.Ajax.requests.mostRecent().respondWith({
        "status": 200,
        "contentType": 'application/json',
        "responseText": '{"expectedKey": "expectedValue"}'
      });
      expect(callback).toHaveBeenCalledWith({'expectedKey': 'expectedValue'});
    });
  });

  describe('getAvailabilityForDocuments', function() {
    it('requests the correct URL', function() {
      recap.getAvailabilityForDocuments(docUrls, 'canb', function() {});
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://www.courtlistener.com/api/rest/v3/recap-query/?' +
          'pacer_doc_id__in=https%3A%2F%2Fecf.canb.uscourts.gov' + 
          '%2Fdoc1%2F034031424909%2Chttps%3A%2F%2Fecf.canb.uscourts.gov' +
          '%2Fdoc1%2F034031425808%2Chttps%3A%2F%2Fecf.canb.uscourts.gov' +
          '%2Fdoc1%2F034031438754&docket_entry__docket__court=canb');
    });

    it('calls the callback with the parsed server response', function() {
      var callback = jasmine.createSpy();
      recap.getAvailabilityForDocuments(docUrls, 'canb', callback);
      jasmine.Ajax.requests.mostRecent().respondWith({
        "status": 200,
        "contentType": 'application/json',
        "responseText": '{"expectedKey": "expectedValue"}'
      });
      expect(callback).toHaveBeenCalledWith({'expectedKey': 'expectedValue'});
    });
  });

  describe('uploadDocket', function() {
    var existingFormData;
    beforeEach(function() {
      setupChromeSpy();
      existingFormData = window.FormData;
      window.FormData = FormDataFake;
    });
    
    afterEach(function() {
      window.FormData = existingFormData;
      removeChromeSpy();
    });

    it('requests the correct URL', function() {
      recap.uploadDocket(court, pacer_doc_id, filename, type, html);
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://www.courtlistener.com/api/rest/v3/recap/');
    });

    it('sends the correct FormData', function() {
      expected = new FormDataFake();
      expected.append('upload_type', 1);
      expected.append('court', court);
      expected.append('pacer_case_id', pacer_case_id);
      expected.append('filepath_local', new Blob(
        [html], {type: type}), filename);

      recap.uploadDocket(court, pacer_case_id, html, 'DOCKET', function() {});
      var actualData = jasmine.Ajax.requests.mostRecent().data();
      expect(actualData).toEqual(jasmine.objectContaining(expected));
    });
  });

  describe('uploadAttachmentMenu', function() {
    var existingFormData;
    beforeEach(function() {
      setupChromeSpy();
      existingFormData = window.FormData;
      window.FormData = FormDataFake;
    });
    
    afterEach(function() {
      window.FormData = existingFormData;
      removeChromeSpy();
    });

    it('requests the correct URL', function() {
      recap.uploadAttachmentMenu(court, filename, type, html);
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://www.courtlistener.com/api/rest/v3/recap/');
    });

    it('sends the correct FormData', function() {
      var expected = new FormDataFake();
      expected.append('court', court);
      expected.append('pacer_case_id', pacer_case_id);
      expected.append('upload_type', 2);
      expected.append('filepath_local', new Blob(
        [html], {type: type}), filename);

      recap.uploadAttachmentMenu(court, pacer_case_id, html, function() {});
      var actualData = jasmine.Ajax.requests.mostRecent().data();
      expect(actualData).toEqual(jasmine.objectContaining(expected));
    });
  });

  describe('uploadDocument', function() {
    var existingFormData;
    beforeEach(function() {
      setupChromeSpy();
      existingFormData = window.FormData;
      window.FormData = FormDataFake;
    });
    
    afterEach(function() {
      window.FormData = existingFormData;
      removeChromeSpy();
    });

    var path = '/doc1/127015406472';
    var bytes = new Uint8Array([100, 100, 200, 200, 300]);

    it('requests the correct URL', function() {
      recap.uploadDocument(
        court, pacer_case_id, pacer_doc_id, docnum, attachnum, bytes,
        function() {});
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://www.courtlistener.com/api/rest/v3/recap/');
    });

    it('sends the correct FormData', function() {

      var expected = new FormDataFake();
      expected.append('court', court);
      expected.append('pacer_case_id', pacer_case_id);
      expected.append('pacer_doc_id', pacer_doc_id);
      expected.append('document_number', docnum);
      expected.append('attachment_number', attachnum);
      expected.append('upload_type', 3);
      expected.append('filepath_local', new Blob(
        [html], {type: type}), filename);

      // pacer_court, pacer_case_id, pacer_doc_id,
      // document_number, attachment_number, bytes, cb

      recap.uploadDocument(
        court, pacer_case_id, pacer_doc_id, docnum, attachnum, bytes,
        function() {});
      var actualData = jasmine.Ajax.requests.mostRecent().data();
      expect(actualData).toEqual(jasmine.objectContaining(expected));
    });
  });
});
