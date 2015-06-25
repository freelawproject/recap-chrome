describe('The Recap export module', function() {
  var recap = Recap();

  var docUrls = [
    'https://ecf.canb.uscourts.gov/doc1/034031424909',
    'https://ecf.canb.uscourts.gov/doc1/034031425808',
    'https://ecf.canb.uscourts.gov/doc1/034031438754'
  ];
  var court = 'nysd';
  var docid = '127015406472';
  var casenum = '437098';
  var de_seq_num = '70';
  var dm_id = '14114895';
  var docnum = '4';
  var offCaseNum = '12344321';
  var subdocnum = '0';
  var filename = 'DktRpt.html';
  var type = 'text/html';
  var html = '<html></html>';

  var fakeFormData = {
    append: function(key, value) {
      this[key] = value;
    }
  };
  var FormDataFake = function() {
    return fakeFormData;
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
        sync: {
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
    caseObj[casenum] = {'casenum': casenum, 'officialcasenum': offCaseNum};
    docObj[docid] = {'casenum': casenum, 'officialcasenum': offCaseNum,
                     'docnum': docnum, 'subdocnum': subdocnum};
    return {'documents': docObj, 'cases': caseObj, 'message': msg};
  }

  function expectMetadata(actCasenum, actOff, actDocnum, actSubdocnum) {
    expect(actCasenum).toBe(casenum);
    expect(actOff).toBe(offCaseNum);
    expect(actDocnum).toBe(docnum);
    expect(actSubdocnum).toBe(subdocnum);
  }

  describe('getAvailabilityForDocket', function() {
    it('requests the correct URL', function() {
      recap.getAvailabilityForDocket();
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://recapextension.org/recap/query_cases/');
    });

    it('encodes the court and casenum in the POST data', function() {
      var expectedCourt = 'canb';
      var expectedCaseNum = '531316';
      recap.getAvailabilityForDocket(expectedCourt, expectedCaseNum);
      var actualData = jasmine.Ajax.requests.mostRecent().data();
      var expectedJson = ('{"court":"'+expectedCourt+'","casenum":"'+
                          expectedCaseNum+'"}');
      expect(actualData['json'][0]).toBe(expectedJson);
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
      recap.getAvailabilityForDocuments(docUrls);
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://recapextension.org/recap/query/');
    });

    it('encodes the court and urls in the POST data', function() {
      recap.getAvailabilityForDocuments(docUrls);
      var actualData = jasmine.Ajax.requests.mostRecent().data();
      var expectedJson = ('{"court":"canb","urls":["https://ecf.canb.uscourts' +
                          '.gov/doc1/034031424909",' +
                          '"https://ecf.canb.uscourts.gov/doc1/034031425808",' +
                          '"https://ecf.canb.uscourts.gov/doc1/034031438754"]}');
      expect(actualData['json'][0]).toBe(expectedJson);
    });

    it('calls the callback with the parsed server response', function() {
      var callback = jasmine.createSpy();
      recap.getAvailabilityForDocuments(docUrls, callback);
      jasmine.Ajax.requests.mostRecent().respondWith({
        "status": 200,
        "contentType": 'application/json',
        "responseText": '{"expectedKey": "expectedValue"}'
      });
      expect(callback).toHaveBeenCalledWith({'expectedKey': 'expectedValue'});
    });
  });

  describe('uploadMetadata', function() {
    beforeEach(setupChromeSpy);
    afterEach(removeChromeSpy);

    it('requests the correct URL', function() {
      recap.uploadMetadata(court, docid, casenum, de_seq_num, dm_id, docnum);
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://recapextension.org/recap/adddocmeta/');
    });

    it('sends the correct FormData', function() {
      spyOn(window, 'FormData').and.callFake(FormDataFake);

      var expected = new FormDataFake();
      expected.append('court', court);
      expected.append('docid', docid);
      expected.append('casenum', casenum);
      expected.append('de_seq_num', de_seq_num);
      expected.append('dm_id', dm_id);
      expected.append('docnum', docnum);
      expected.append('add_case_info', 'true');

      recap.uploadMetadata(court, docid, casenum, de_seq_num, dm_id, docnum);
      var actualData = jasmine.Ajax.requests.mostRecent().data();
      expect(actualData).toEqual(expected);
    });

    it('updates the local metadata', function() {
      var resp = setupMetadataResponse('successfully updated');
      recap.uploadMetadata(court, docid, casenum, de_seq_num, dm_id, docnum,
                          function() {});
      jasmine.Ajax.requests.mostRecent().respondWith({
        "status": 200,
        "contentType": 'application/json',
        "responseText": JSON.stringify(resp)
      });
      recap.getDocumentMetadata(docid, expectMetadata);
    });
  });

  describe('uploadDocket', function() {
    beforeEach(setupChromeSpy);
    afterEach(removeChromeSpy);

    it('requests the correct URL', function() {
      recap.uploadDocket(court, casenum, filename, type, html);
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://recapextension.org/recap/upload/');
    });

    it('sends the correct FormData', function() {
      spyOn(window, 'FormData').and.callFake(FormDataFake);

      expected = new FormDataFake();
      expected.append('court', court);
      expected.append('mimetype', type);
      expected.append('data', new Blob([html], {type: type}), filename);

      recap.uploadDocket(court, casenum, filename, type, html);
      var actualData = jasmine.Ajax.requests.mostRecent().data();
      expect(actualData).toEqual(expected);
    });

    it('updates the local metadata', function() {
      var resp = setupMetadataResponse('successfully updated');
      recap.uploadDocket(court, casenum, filename, type, html, function() {});
      jasmine.Ajax.requests.mostRecent().respondWith({
        "status": 200,
        "contentType": 'application/json',
        "responseText": JSON.stringify(resp)
      });
      recap.getDocumentMetadata(docid, expectMetadata);
    });
  });

  describe('uploadAttachmentMenu', function() {
    beforeEach(setupChromeSpy);
    afterEach(removeChromeSpy);

    it('requests the correct URL', function() {
      recap.uploadAttachmentMenu(court, filename, type, html);
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://recapextension.org/recap/upload/');
    });

    it('sends the correct FormData', function() {
      spyOn(window, 'FormData').and.callFake(FormDataFake);

      var expected = new FormDataFake();
      expected.append('court', court);
      expected.append('mimetype', type);
      expected.append('data', new Blob([html], {type: type}), filename);

      recap.uploadAttachmentMenu(court, filename, type, html);
      var actualData = jasmine.Ajax.requests.mostRecent().data();
      expect(actualData).toEqual(expected);
    });

    it('updates the local metadata', function() {
      var resp = setupMetadataResponse('successfully updated');
      recap.uploadAttachmentMenu(court, filename, type, html, function() {});
      jasmine.Ajax.requests.mostRecent().respondWith({
        "status": 200,
        "contentType": 'application/json',
        "responseText": JSON.stringify(resp)
      });
      recap.getDocumentMetadata(docid, expectMetadata);
    });
  });

  describe('uploadDocument', function() {
    beforeEach(setupChromeSpy);
    afterEach(removeChromeSpy);

    var path = '/doc1/127015406472';
    var bytes = new Uint8Array([100, 100, 200, 200, 300]);

    it('requests the correct URL', function() {
      recap.uploadDocument(court, path, filename, type, bytes);
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://recapextension.org/recap/upload/');
    });

    it('sends the correct FormData', function() {
      spyOn(window, 'FormData').and.callFake(FormDataFake);

      var expected = new FormDataFake();
      expected.append('court', court);
      expected.append('url', path);
      expected.append('mimetype', type);
      expected.append('data', new Blob([html], {type: type}), filename);

      recap.uploadDocument(court, path, filename, type, bytes);
      var actualData = jasmine.Ajax.requests.mostRecent().data();
      expect(actualData).toEqual(expected);
    });
  });
});
