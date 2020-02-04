/*global jasmine */

describe('The Recap export module', function() {
  const recap = Recap();

  const docUrls = [
    'https://ecf.canb.uscourts.gov/doc1/034031424909',
    'https://ecf.canb.uscourts.gov/doc1/034031425808',
    'https://ecf.canb.uscourts.gov/doc1/034031438754'
  ];
  const court = 'nysd';
  const pacer_doc_id = '127015406472';
  const pacer_case_id = '437098';
  const docnum = '4';
  const attachnum = '1';
  const offCaseNum = '12344321';
  const subdocnum = '0';
  const filename = 'DktRpt.html';
  const type = 'text/html';
  const html = '<html lang="en"></html>';

  const FormDataFake = function () {
  };
  FormDataFake.prototype.append = function(key, value) {
    this[key] = value;
  };

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
    const caseObj = {};
    const docObj = {};
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
        'https://www.courtlistener.com/api/rest/v3/dockets/?source__in=1%2C3%2C5%2C7%2C9%2C11%2C13%2C15&fields=absolute_url%2Cdate_modified');
    });

    it('encodes the court and caseId in the GET params', function() {
      const expectedCourt = 'canb';
      const expectedCaseId = '531316';
      recap.getAvailabilityForDocket(expectedCourt, expectedCaseId);
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://www.courtlistener.com/api/rest/v3/dockets/' +
          '?pacer_case_id=531316' +
          '&source__in=1%2C3%2C5%2C7%2C9%2C11%2C13%2C15' +
          '&court=canb&' +
          'fields=absolute_url%2Cdate_modified');
    });

    it('calls the callback with the parsed server response', function() {
      const callback = jasmine.createSpy();
      const expectedCourt = 'canb';
      const expectedCaseNum = '531316';
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
      const callback = jasmine.createSpy();
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
    let existingFormData;

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
      const expected = new FormDataFake();
      expected.append('upload_type', 1);
      expected.append('court', court);
      expected.append('pacer_case_id', pacer_case_id);
      expected.append('filepath_local', new Blob(
        [html], {type: type}), filename);

      recap.uploadDocket(court, pacer_case_id, html, 'DOCKET', function() {});
      const actualData = jasmine.Ajax.requests.mostRecent().data();
      expect(actualData).toEqual(jasmine.objectContaining(expected));
    });
  });

  describe('uploadAttachmentMenu', function() {
    let existingFormData;

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
      const expected = new FormDataFake();
      expected.append('court', court);
      expected.append('pacer_case_id', pacer_case_id);
      expected.append('upload_type', 2);
      expected.append('filepath_local', new Blob(
        [html], {type: type}), filename);

      recap.uploadAttachmentMenu(court, pacer_case_id, html, function() {});
      const actualData = jasmine.Ajax.requests.mostRecent().data();
      expect(actualData).toEqual(jasmine.objectContaining(expected));
    });
  });

  describe('uploadDocument', function() {
    let existingFormData;

    const bytes = new Uint8Array([100, 100, 200, 200, 300]);
    const blob = new Blob([html], {type: type}, filename);
    const nonce = 'blob_upload_storage'

    beforeEach(function() {
      window.chrome = {
        storage: {
          local: {
            get: jasmine.createSpy('get').and.callFake((_, cb) => cb({ [nonce]: blob })),
            set: jasmine.createSpy('set')
          }
        }
      }
      existingFormData = window.FormData;
      window.FormData = FormDataFake;
    });

    afterEach(function() {
      window.FormData = existingFormData;
      delete window.chrome;
    });



    it('requests the correct URL', function() {
      recap.uploadDocument(
        court, pacer_case_id, pacer_doc_id, docnum, attachnum, nonce,
        function() {});
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://www.courtlistener.com/api/rest/v3/recap/');
    });

    it('sends the correct FormData', function() {
      const expected = new FormDataFake();
      expected.append('court', court);
      expected.append('pacer_case_id', pacer_case_id);
      expected.append('pacer_doc_id', pacer_doc_id);
      expected.append('document_number', docnum);
      expected.append('attachment_number', attachnum);
      expected.append('upload_type', 3);
      // intentionally omitting test of chrome storage promises
      // we pass the actual blob to the form instead of mocking
      // the setting and retrieval of items in chrome storage
      expected.append('filepath_local', blob)

      // pacer_court, pacer_case_id, pacer_doc_id,
      // document_number, attachment_number, nonce, cb

      recap.uploadDocument(
        court, pacer_case_id, pacer_doc_id, docnum, attachnum, nonce,
        function() {});
      const actualData = jasmine.Ajax.requests.mostRecent().data();
      expect(actualData).toEqual(jasmine.objectContaining(expected));
    });
  });
});
