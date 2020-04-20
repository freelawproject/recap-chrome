/*global jasmine */
describe('The Recap export module', function () {
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
  const blob = new Blob([new ArrayBuffer(1000)], { type: 'application/pdf' });

  // in utils, the callback is assigned the caller tab info
  // we use that to send the tabId to background worker so
  // we mock it here
  const callback = jasmine.createSpy().and.callFake(() => { });
  callback.tab = { id: 1234 };

  const FormDataFake = function () {
  };
  FormDataFake.prototype.append = function (key, value) {
    this[key] = value;
  };

  beforeEach(function () {
    jasmine.Ajax.install();
    jasmine.Ajax.addCustomParamParser({
      // This custom parser simply echos back the params, used for fake
      // FormData objects.
      test: function (xhr) {
        // The params are a plain object with a court property.
        if (xhr.params instanceof Object) {
          return ('court' in xhr.params)
        }
        return false;
      },
      parse: function (formData) {
        return formData;
      }
    })
    spyOn(window, 'fetch').and.callFake((url, options) => {
      const res = {};
      res.status = jasmine.createSpy().and.callFake(() => Promise.resolve('200'));
      res.text = jasmine.createSpy().and.callFake(() => Promise.resolve(`<html><iframe src="http://dummylink.com"></iframe></html>`));
      res.json = jasmine.createSpy().and.callFake(() => Promise.resolve({ result: true }));
      res.blob = jasmine.createSpy().and.callFake(() => Promise.resolve(blob));
      return Promise.resolve(res);
    });
  });

  afterEach(function () {
    jasmine.Ajax.uninstall();
  });

  async function setupChromeSpy() {
    const dataUrl = await blobToDataURL(blob);
    window.chrome = {
      storage: {
        local: {
          get: jasmine.createSpy('get').and.callFake((_, cb) => {
            cb({
              options: {
                recap_enabled: true,
                ['ia_style_filenames']: true,
                ['lawyer_style_filenames']: false,
                ['external_pdf']: true
              },
              ['1234']: {
                ['pdf_blob']: dataUrl,
                docsToCases: { ['034031424909']: '531591' }
              }
            });
          }),
          remove: jasmine.createSpy('remove').and.callFake(() => { }),
          set: jasmine.createSpy('set').and.callFake(function () { })
        }
      }
    };
  }

  function removeChromeSpy() {
    delete window.chrome;
  }

  describe('getAvailabilityForDocket', function () {
    it('encodes the court and caseId in the GET params', function () {
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

    it('calls the callback with the parsed server response', function () {
      const callback = jasmine.createSpy();
      const expectedCourt = 'canb';
      const expectedCaseNum = '531316';
      recap.getAvailabilityForDocket(expectedCourt, expectedCaseNum, callback);
      jasmine.Ajax.requests.mostRecent().respondWith({
        "status": 200,
        "contentType": 'application/json',
        "responseText": '{"expectedKey": "expectedValue"}'
      });
      expect(callback).toHaveBeenCalledWith({ 'expectedKey': 'expectedValue' });
    });
  });

  describe('getAvailabilityForDocuments', function () {
    it('requests the correct URL', function () {
      recap.getAvailabilityForDocuments(docUrls, 'canb', function () { });
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://www.courtlistener.com/api/rest/v3/recap-query/?' +
        'pacer_doc_id__in=https%3A%2F%2Fecf.canb.uscourts.gov' +
        '%2Fdoc1%2F034031424909%2Chttps%3A%2F%2Fecf.canb.uscourts.gov' +
        '%2Fdoc1%2F034031425808%2Chttps%3A%2F%2Fecf.canb.uscourts.gov' +
        '%2Fdoc1%2F034031438754&docket_entry__docket__court=canb');
    });

    it('calls the callback with the parsed server response', function () {
      const callback = jasmine.createSpy();
      recap.getAvailabilityForDocuments(docUrls, 'canb', callback);
      jasmine.Ajax.requests.mostRecent().respondWith({
        "status": 200,
        "contentType": 'application/json',
        "responseText": '{"expectedKey": "expectedValue"}'
      });
      expect(callback).toHaveBeenCalledWith({ 'expectedKey': 'expectedValue' });
    });
  });

  describe('uploadDocket', function () {
    let existingFormData;

    beforeEach(async () => {
      await setupChromeSpy();
      existingFormData = window.FormData;
      window.FormData = FormDataFake;
    });

    afterEach(function () {
      window.FormData = existingFormData;
      removeChromeSpy();
    });

    it('requests the correct URL', async function () {
      await recap.uploadDocket(court, pacer_doc_id, filename, type, html);
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://www.courtlistener.com/api/rest/v3/recap/');
    });

    it('sends the correct FormData', async function () {
      const expected = new FormDataFake();
      expected.append('upload_type', 1);
      expected.append('court', court);
      expected.append('pacer_case_id', pacer_case_id);
      expected.append('filepath_local', new Blob(
        [html], { type: type }), filename);

      await recap.uploadDocket(court, pacer_case_id, html, 'DOCKET', function () { });
      const actualData = jasmine.Ajax.requests.mostRecent().data();
      expect(actualData).toEqual(jasmine.objectContaining(expected));
    });
  });

  describe('uploadAttachmentMenu', function () {
    let existingFormData;

    beforeEach(async function () {
      await setupChromeSpy();
      existingFormData = window.FormData;
      window.FormData = FormDataFake;
    });

    afterEach(function () {
      window.FormData = existingFormData;
      removeChromeSpy();
    });

    it('requests the correct URL', function () {
      recap.uploadAttachmentMenu(court, filename, type, html);
      expect(jasmine.Ajax.requests.mostRecent().url).toBe(
        'https://www.courtlistener.com/api/rest/v3/recap/');
    });

    it('sends the correct FormData', function () {
      const expected = new FormDataFake();
      expected.append('court', court);
      expected.append('pacer_case_id', pacer_case_id);
      expected.append('upload_type', 2);
      expected.append('filepath_local', new Blob(
        [html], { type: type }), filename);

      recap.uploadAttachmentMenu(court, pacer_case_id, html, function () { });
      const actualData = jasmine.Ajax.requests.mostRecent().data();
      expect(actualData).toEqual(jasmine.objectContaining(expected));
    });
  });

  describe('uploadDocument', function () {
    let existingFormData;
    let nativeFetch;

    beforeEach(async () => {
      nativeFetch = window.fetch;
      existingFormData = window.FormData;
      window.FormData = FormDataFake;
      spyOn(recap, 'uploadDocument').and.callFake(
        (court, case_id, doc_id, doc_number, attach_number, cb) => {
          cb(true);
        }
      );
      await setupChromeSpy();
    });

    afterEach(function () {
      removeChromeSpy();
      window.FormData = existingFormData;
    });

    it('sends the correct FormData and calls the callback', async function () {
      const expected = new FormDataFake();
      const blob = new Blob([new ArrayBuffer(10000)], { type: 'application/pdf' });
      expected.append('court', court);
      expected.append('pacer_case_id', pacer_case_id);
      expected.append('pacer_doc_id', pacer_doc_id);
      expected.append('document_number', docnum);
      expected.append('attachment_number', attachnum);
      expected.append('upload_type', 3);
      // intentionally omitting test of chrome storage promises
      // we pass the actual blob to the form instead of mocking
      // the setting and retrieval of items in chrome storage
      expected.append('filepath_local', blob);

      await recap.uploadDocument(
        court, pacer_case_id, pacer_doc_id, docnum, attachnum,
        callback);
      expect(callback).toHaveBeenCalledWith(true);
    });
  });
  describe('uploadZipFile', function () {
    let existingFormData;

    beforeEach(async () => {
      existingFormData = window.FormData;
      window.FormData = FormDataFake;
      spyOn(recap, 'uploadZipFile').and.callFake(
        (court, pacerCaseId, cb) => {
          cb(true);
        }
      );
      await setupChromeSpy();
    });

    afterEach(function () {
      removeChromeSpy();
      window.FormData = existingFormData;
    });

    it('sends the correct FormData and calls the callback', async function () {
      const expected = new FormDataFake();
      const blob = new Blob([new ArrayBuffer(10000)], { type: 'application/zip' });
      expected.append('court', court);
      expected.append('pacer_case_id', pacer_case_id);
      expected.append('pacer_doc_id', pacer_doc_id);
      expected.append('upload_type', 10);
      expected.append('filepath_local', blob);

      await recap.uploadZipFile(
        court, pacer_case_id, callback);

      expect(callback).toHaveBeenCalledWith(true);
    });
  });
});
