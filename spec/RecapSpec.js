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


  beforeEach(function() {
    jasmine.Ajax.install();
    jasmine.Ajax.addCustomParamParser({
      // If the params are a FormData, simply echo them back.
      test: function(xhr) {
        return xhr.params instanceof FormData;
      },
      parse: function(formData) {
        return formData;
      }
    });
  });

  afterEach(function() {
    jasmine.Ajax.uninstall();
  });

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
    it('requests the correct URL', function() {
      recap.uploadMetadata(court, docid, casenum, de_seq_num, dm_id, docnum);
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://recapextension.org/recap/adddocmeta/');
    });

    // Commented out until we figure out how to compare FormData.
    xit('sends the correct FormData', function() {
      var formData = new FormData();
      formData.append('court', court);
      formData.append('docid', docid);
      formData.append('casenum', casenum);
      formData.append('de_seq_num', de_seq_num);
      formData.append('dm_id', dm_id);
      formData.append('docnum', docnum);
      formData.append('add_case_info', 'true');

      recap.uploadMetadata(court, docid, casenum, de_seq_num, dm_id, docnum);
      var actualData = jasmine.Ajax.requests.mostRecent().data();
      expect(actualData).toEqual(formData);
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
    it('requests the correct URL', function() {
      recap.uploadDocket(court, casenum, filename, type, html);
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://recapextension.org/recap/upload/');
    });

    // Commented out until we figure out how to compare FormData.
    xit('sends the correct FormData', function() {
      var formData = new FormData();
      formData.append('court', court);
      formData.append('mimetype', type);
      formData.append('data', new Blob([html], {type: type}), filename);

      recap.uploadDocket(court, casenum, filename, type, html);
      var actualData = jasmine.Ajax.requests.mostRecent().data();
      expect(actualData).toEqual(formData);
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
    it('requests the correct URL', function() {
      recap.uploadAttachmentMenu(court, filename, type, html);
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://recapextension.org/recap/upload/');
    });

    // Commented out until we figure out how to compare FormData.
    xit('sends the correct FormData', function() {
      var formData = new FormData();
      formData.append('court', court);
      formData.append('mimetype', type);
      formData.append('data', new Blob([html], {type: type}), filename);

      recap.uploadAttachmentMenu(court, filename, type, html);
      var actualData = jasmine.Ajax.requests.mostRecent().data();
      expect(actualData).toEqual(formData);
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
    var path = '/doc1/127015406472';
    var bytes = new Uint8Array([100, 100, 200, 200, 300]);

    it('requests the correct URL', function() {
      recap.uploadDocument(court, path, filename, type, bytes);
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://recapextension.org/recap/upload/');
    });

    // TODO: test of FormData once we figure out how to do that.
  });
});
