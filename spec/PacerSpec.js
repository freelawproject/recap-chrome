describe('The PACER module', function () {
  const nonsenseUrl = 'http://something.uscourts.gov/foobar/baz';
  const maliciousUrl = 'https://ecf.canb.uscourts.gov.evilsite.com/';
  const noTrailingSlashUrl = 'https://ecf.canb.uscourts.gov';
  const docketReportURL = 'https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl';
  const singleDocUrl = 'https://ecf.canb.uscourts.gov/doc1/034031424909';
  const singleDocAudioUrl = 'https://ecf.canb.audio.uscourts.gov/doc1/034031424909';
  const docketQueryUrl = 'https://ecf.canb.uscourts.gov/cgi-bin/' + 'HistDocQry.pl?531316';
  const docketQueryUrlFromAppellate =
    'https://ecf.canb.uscourts.gov/cgi-bin/' + 'DktRpt.pl?caseNumber=2:16-cv-01129-RFB-DJA';
  const docketQueryUrlWithMultiParameter =
    'https://ecf.canb.uscourts.gov/cgi-bin/' + 'DktRpt.pl?caseNumber=1:17-cv-10577&caseId=0';
  const appellateDocumentUrl = 'https://ecf.ca2.uscourts.gov/docs1/00205695758';

  const AcmsDocketUrl = 'https://ca9-showdoc.azurewebsites.us/23-2081';
  const AcmsDocumentUrl = 'https://ca9-showdoc.azurewebsites.us/download-confirmation/c61cb56b-9a5c-ee11-be6e-001dd8087d6a?loadEntry=1';
  const EcfCaseQueryAcmsCaseUrl = 'https://ecf.ca9.uscourts.gov/n/beam/servlet/TransportRoom?servlet=CaseQuery.jsp&cnthd=1234567890&caseid=1007067&csnum1=23-2081&shorttitle=International+Brotherhood+of+Teamsters+v.+National+Labor+Relations+Board';
  const nonAcmsAzureGovUrl = 'https://dc-ecosproduction.azurewebsites.us/login.aspx';
  const AcmsFilingUrl = 'https://ca9-portal.powerappsportals.us/';
  const AcmsFilingTestUrl = 'https://ca9-acms-pcx.powerappsportals.us/';
  const FedcourtsNinthUrl = 'https://ca9.fedcourts.us';
  const FedcourtsBogusUrl = 'https://bogus.fedcourts.us';

  function InputContainer() {
    document.body.innerHTML = '';
    const inputContainer = document.createElement('div');
    inputContainer.id = 'cmecfMainContent';
    return inputContainer;
  }

  function removeInputContainer() {
    document.getElementById('cmecfMainContent').remove();
  }

  function InputWithValue(value, type = 'button') {
    const input = document.createElement('input');
    input.value = value;
    input.type = type;
    return input;
  }

  describe('getCourtFromUrl', function () {
    it('matches a valid docket query URL', function () {
      expect(PACER.getCourtFromUrl(docketQueryUrl)).toBe('canb');
    });

    it('matches a valid single doc URL', function () {
      expect(PACER.getCourtFromUrl(singleDocUrl)).toBe('canb');
    });

    it('matches a valid single doc audio URL', function () {
      expect(PACER.getCourtFromUrl(singleDocAudioUrl)).toBe('canb');
    });

    it('ignores patent nonsense', function () {
      expect(PACER.getCourtFromUrl(nonsenseUrl)).toBe(null);
    });

    it('cannot be fooled by extra subdomains', function () {
      expect(PACER.getCourtFromUrl(maliciousUrl)).toBe(null);
    });

    it('matches even if trailing slash is absent', function () {
      expect(PACER.getCourtFromUrl(noTrailingSlashUrl)).toBe('canb');
    });

    it('matches a valid ACMS docket URL', function () {
      expect(PACER.getCourtFromUrl(AcmsDocketUrl)).toBe('ca9');
    });

    it('matches a valid ACMS document URL', function () {
      expect(PACER.getCourtFromUrl(AcmsDocumentUrl)).toBe('ca9');
    });

    it('matches a valid ECF/PACER CaseQuery for an ACMS docket URL', function () {
      expect(PACER.getCourtFromUrl(EcfCaseQueryAcmsCaseUrl)).toBe('ca9');
    });

    it('ignores a non-ACMS Azure URL', function () {
      expect(PACER.getCourtFromUrl(nonAcmsAzureGovUrl)).toBe(null);
    });

    it('ignores an ACMS production filing URL', function () {
      expect(PACER.getCourtFromUrl(AcmsFilingUrl)).toBe(null);
    });

    it('ignores an ACMS test filing URL', function () {
      expect(PACER.getCourtFromUrl(AcmsFilingTestUrl)).toBe(null);
    });

    it('ignores a Fedcourts email domain as a URL', function () {
      expect(PACER.getCourtFromUrl(FedcourtsNinthUrl)).toBe(null);
    });

    it('ignores a Fedcourts non-court URL', function () {
      expect(PACER.getCourtFromUrl(FedcourtsBogusUrl)).toBe(null);
    });

  });

  describe('convertToCourtListenerCourt', function () {
    it('should convert properly', function () {
      expect(PACER.convertToCourtListenerCourt('azb')).toBe('arb');
    });
    it('should not change if not needed', function () {
      expect(PACER.convertToCourtListenerCourt('akb')).toBe('akb');
    });
  });

  describe('isDocumentUrl', function () {
    it('matches a valid document URL', function () {
      expect(PACER.isDocumentUrl(singleDocUrl)).toBe(true);
    });

    it('matches a valid appellate document URL', function () {
      expect(PACER.isDocumentUrl(appellateDocumentUrl)).toBe(true);
    });

    const showDocUrl =
      'https://ecf.cacd.uscourts.gov/cgi-bin/show_doc.pl?' + 'caseid=560453&de_seq_num=24&dm_id=15521444&doc_num=7';

    it('matches a valid show_doc document URL', function () {
      expect(PACER.isDocumentUrl(showDocUrl)).toBe(true);
    });

    it('returns false for a non-document court URL', function () {
      expect(PACER.isDocumentUrl(docketQueryUrl)).toBe(false);
    });

    it('returns false for patent nonsense', function () {
      expect(PACER.isDocumentUrl(nonsenseUrl)).toBe(false);
    });
  });

  describe('isDoc1Url', function () {
    it('matches a valid doc1 URL', function () {
      expect(PACER.isDoc1Url(singleDocUrl)).toBe(true);
    });

    it('matches a valid appellate document URL', function () {
      expect(PACER.isDoc1Url(appellateDocumentUrl)).toBe(true);
    });

    const showDocUrl =
      'https://ecf.cacd.uscourts.gov/cgi-bin/show_doc.pl?' + 'caseid=560453&de_seq_num=24&dm_id=15521444&doc_num=7';

    it('returns false for a valid show_doc document URL', function () {
      expect(PACER.isDoc1Url(showDocUrl)).toBe(false);
    });

    it('returns false for a non-document court URL', function () {
      expect(PACER.isDoc1Url(docketQueryUrl)).toBe(false);
    });

    it('returns false for patent nonsense', function () {
      expect(PACER.isDoc1Url(nonsenseUrl)).toBe(false);
    });
  });

  describe('isDocketQueryUrl', function () {
    it('matches a docket query URL with digits in the query string', function () {
      expect(PACER.isDocketQueryUrl(docketQueryUrl)).toBe(true);
    });

    it('matches a docket query URL with one parameter in the query string', function () {
      expect(PACER.isDocketQueryUrl(docketQueryUrlFromAppellate)).toBe(true);
    });

    it('matches a docket query URL with multiple parameters in the query string', function () {
      expect(PACER.isDocketQueryUrl(docketQueryUrlWithMultiParameter)).toBe(true);
    });

    it('returns false for a docket query URL that does not have querystring', function () {
      expect(PACER.isDocketQueryUrl(docketReportURL)).toBe(false);
    });

    it('returns false for a document URL', function () {
      expect(PACER.isDocketQueryUrl(singleDocUrl)).toBe(false);
    });

    it('returns false for patent nonsense', function () {
      expect(PACER.isDocketQueryUrl(nonsenseUrl)).toBe(false);
    });
  });

  describe('isDocketDisplayUrl', function () {
    const docketDisplayUrl = 'https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?' + '101092135737069-L_1_0-1';

    it('matches a docket display URL', function () {
      expect(PACER.isDocketDisplayUrl(docketDisplayUrl)).toBe(true);
    });

    it('returns false for a docket query URL', function () {
      expect(PACER.isDocketDisplayUrl(docketQueryUrl)).toBe(false);
    });

    it('returns false for a document URL', function () {
      expect(PACER.isDocketDisplayUrl(singleDocUrl)).toBe(false);
    });

    it('returns false for patent nonsense', function () {
      expect(PACER.isDocketDisplayUrl(nonsenseUrl)).toBe(false);
    });

    const caseDefault = 'https://ecf.ca1.uscourts.gov/n/beam/servlet/TransportRoom?' + 'servlet=Nonsense.jsp';

    it('returns false for other jsp pages', function () {
      expect(PACER.isDocketDisplayUrl(caseDefault)).toBe(false);
    });

    const caseSearch = 'https://ecf.ca1.uscourts.gov/n/beam/servlet/TransportRoom?' + 'servlet=CaseSearch.jsp';

    it('returns false for other jsp pages', function () {
      expect(PACER.isDocketDisplayUrl(caseSearch)).toBe(false);
    });
  });

  describe('isDocketHistoryDisplayUrl', function () {
    const historyUrl = 'https://ecf.ca1.uscourts.gov/HistDocQry.pl?fred-fred';
    it('should recognize a history url', function () {
      expect(PACER.isDocketHistoryDisplayUrl(historyUrl)).toBe(true);
    });
  });

  describe('formatDocketQueryUrl', function () {
    it('should return a properly formatted URL', function () {
      expect(PACER.formatDocketQueryUrl(docketReportURL, 365816)).toBe(docketReportURL + '?365816');
    });

    it('should not change if not needed', function () {
      expect(PACER.formatDocketQueryUrl(docketReportURL + '?365816', 365816)).toBe(docketReportURL + '?365816');
    });
  });

  describe('isAttachmentMenuPage', function () {
    describe('for documents with a matching input for PACER 1.6 or older', function () {
      beforeEach(function () {
        let main_div = InputContainer();
        main_div.appendChild(InputWithValue('Download All', 'button'));
        document.body.appendChild(main_div);
        document.getElementById = jasmine.createSpy('getElementById').and.callFake((id) => {
          if (id != 'cmecfMainContent') {
            return null;
          }
          return main_div;
        });
      });

      afterEach(function () {
        removeInputContainer();
      });

      it('returns true when the URL is valid', function () {
        expect(PACER.isAttachmentMenuPage(singleDocUrl, document)).toBe(true);
      });

      it('returns false when the URL is invalid', function () {
        expect(PACER.isAttachmentMenuPage(docketQueryUrl, document)).toBe(false);
      });
    });

    describe('for documents with a matching input for PACER 1.7', function () {
      beforeEach(function () {
        let main_div = InputContainer();
        main_div.appendChild(InputWithValue('View Selected', 'button'));
        main_div.appendChild(InputWithValue('Download Selected', 'button'));
        document.body.appendChild(main_div);
        document.getElementById = jasmine.createSpy('getElementById').and.callFake((id) => {
          if (id != 'cmecfMainContent') {
            return null;
          }
          return main_div;
        });
      });

      afterEach(function () {
        removeInputContainer();
      });

      it('returns true when the URL is valid', function () {
        expect(PACER.isAttachmentMenuPage(singleDocUrl, document)).toBe(true);
      });

      it('returns false when the URL is invalid', function () {
        expect(PACER.isAttachmentMenuPage(docketQueryUrl, document)).toBe(false);
      });
    });

    describe('for documents with a combined size over size limit', function () {
      beforeEach(function () {
        let main_div = InputContainer();
        main_div.innerHTML =
          'You must view each document individually because the combined PDF would be over the 50 MB size limit.';
        document.body.appendChild(main_div);
        document.getElementById = jasmine.createSpy('getElementById').and.callFake((id) => {
          if (id != 'cmecfMainContent') {
            return null;
          }
          return main_div;
        });
      });

      afterEach(function () {
        removeInputContainer();
      });

      it('returns true when the URL is valid', function () {
        expect(PACER.isAttachmentMenuPage(singleDocUrl, document)).toBe(true);
      });

      it('returns false when the URL is invalid', function () {
        expect(PACER.isAttachmentMenuPage(docketQueryUrl, document)).toBe(false);
      });
    });

    describe('for documents which have non-matching inputs', function () {
      beforeEach(function () {
        let main_div = InputContainer();
        main_div.appendChild(InputWithValue('View files'));
        main_div.appendChild(InputWithValue('View all'));
        document.body.appendChild(main_div);
        document.getElementById = jasmine.createSpy('getElementById').and.callFake((id) => {
          if (id != 'cmecfMainContent') {
            return null;
          }
          return main_div;
        });
      });

      afterEach(function () {
        removeInputContainer();
      });

      it('returns false with valid URL', function () {
        expect(PACER.isAttachmentMenuPage(singleDocUrl, document)).toBe(false);
      });
    });

    describe('for documents which have not matching format', function () {
      beforeEach(function () {
        let main_div = InputContainer();
        main_div.appendChild(document.createElement('div'));
        document.getElementById = jasmine.createSpy('getElementById').and.callFake((id) => {
          if (id != 'cmecfMainContent') {
            return null;
          }
          return main_div;
        });
      });

      afterEach(function () {
        removeInputContainer();
      });

      it('returns false with a valid URL', function () {
        expect(PACER.isAttachmentMenuPage(singleDocUrl, document)).toBe(false);
      });
    });
  });

  describe('isSingleDocumentPage', function () {
    describe('for documents with a matching input', function () {
      beforeEach(function () {
        let main = InputContainer();
        main.appendChild(InputWithValue('View Document'));
        let table = document.createElement('table');
        let tr_image = document.createElement('tr');
        let td_image = document.createElement('td');
        td_image.innerHTML = 'Image 1234-9876';
        tr_image.appendChild(td_image);
        table.appendChild(tr_image);
        main.appendChild(table);
        document.body.appendChild(main);
      });

      afterEach(function () {
        removeInputContainer();
      });

      it('returns true when the URL is valid', function () {
        expect(PACER.isSingleDocumentPage(singleDocUrl, document)).toBe(true);
      });

      it('return false when the URL is invalid', function () {
        expect(PACER.isSingleDocumentPage(docketQueryUrl, document)).toBe(false);
      });
    });

    describe('for documents which have non-matching inputs', function () {
      beforeEach(function () {
        let main = InputContainer();
        main.appendChild(InputWithValue('Download One'));
        main.appendChild(InputWithValue('Download Some'));
        document.body.appendChild(main);
      });

      afterEach(function () {
        removeInputContainer();
      });

      it('returns false with valid URL', function () {
        expect(PACER.isSingleDocumentPage(singleDocUrl, document)).toBe(false);
      });
    });

    describe('for documents which have non-matching format', function () {
      beforeEach(function () {
        let main = InputContainer();
        main.appendChild(document.createElement('div'));
        document.body.appendChild(main);
      });

      afterEach(function () {
        removeInputContainer();
      });

      it('returns false with a valid URL', function () {
        expect(PACER.isSingleDocumentPage(singleDocUrl, document)).toBe(false);
      });
    });
  });

  describe('getDocumentIdFromUrl', function () {
    it('returns the correct document id for a valid URL', function () {
      expect(PACER.getDocumentIdFromUrl(singleDocUrl)).toBe('034031424909');
    });

    it('returns the correct document id for a valid appellate URL', function () {
      expect(PACER.getDocumentIdFromUrl(appellateDocumentUrl)).toBe('00205695758');
    });

    it('coerces the fourth digit to zero', function () {
      let fourthSetUrl = singleDocUrl.replace('034031424909', '034131424909');
      expect(PACER.getDocumentIdFromUrl(fourthSetUrl)).toBe('034031424909');
    });
  });

  describe('getDocumentIdFronForm', function () {
    const goDLS = "goDLS('/doc1/09518360046','153992','264','','','1','','');";
    let form;
    beforeEach(function () {
      form = document.createElement('form');
      const input = document.createElement('input');
      input.value = 'View Document';
      form.appendChild(input);
      form.setAttribute('onSubmit', goDLS);
      document.body.appendChild(form);
    });

    afterEach(function () {
      form.remove();
    });

    it('should return document id', function () {
      expect(PACER.getDocumentIdFromForm(appellateDocumentUrl, document)).toBe('09508360046');
    });
  });

  describe('getCaseNumberFromUrl', function () {
    it('returns the right case number for a docket query URL', function () {
      expect(PACER.getCaseNumberFromUrls([docketQueryUrl])).toBe('531316');
    });

    it('returns null for a document URL', function () {
      expect(PACER.getCaseNumberFromUrls([singleDocUrl])).toBeUndefined();
    });

    it('returns null for patent nonsense', function () {
      expect(PACER.getCaseNumberFromUrls([nonsenseUrl])).toBeUndefined();
    });

    const cmecfUrl = 'https://ecf.cmecf.uscourts.gov/cgi-bin/' + 'HistDocQry.pl?0';

    it('returns caseNum', function () {
      expect(PACER.getCaseNumberFromUrls([cmecfUrl])).toBeUndefined();
    });
  });

  describe('getCaseNumberFromInputs', function () {
    const goDLS = "goDLS('/doc1/09518360046','153992','264','','','1','','');";
    const input = document.createElement('input');

    beforeEach(function () {
      const form = document.createElement('form');
      document.body.appendChild(form);
      input.type = 'button';
      form.append(input);
      form.setAttribute('onSubmit', goDLS);
    });

    afterEach(function () {
      document.getElementsByTagName('form')[0].remove();
    });

    it('should return a case number for Download All', function () {
      input.value = 'Download All';
      input.setAttribute('onClick', '&caseid=44127');
      expect(PACER.getCaseNumberFromInputs(appellateDocumentUrl, document)).toBe('44127');
    });

    it('should return a case number for View Document', function () {
      input.value = 'View Document';
      expect(PACER.getCaseNumberFromInputs(appellateDocumentUrl, document)).toBe('153992');
    });
  });

  describe('getBaseNameFromUrl', function () {
    it('gets the proper basename for a docket URL', function () {
      expect(PACER.getBaseNameFromUrl(docketQueryUrl)).toBe('HistDocQry.pl');
    });

    it('gets the proper basename for a document URL', function () {
      expect(PACER.getBaseNameFromUrl(singleDocUrl)).toBe('034031424909');
    });
  });

  describe('parseGoDLSFunction', function () {
    it('gets the right values for an example DLS string', function () {
      let goDLSSampleString = "goDLS('/doc1/09518360046','153992','264','','','1','',''); " + 'return(false);';
      expect(PACER.parseGoDLSFunction(goDLSSampleString)).toEqual({
        hyperlink: '/doc1/09518360046',
        de_caseid: '153992',
        de_seqno: '264',
        got_receipt: '',
        pdf_header: '',
        pdf_toggle_possible: '1',
        magic_num: '',
        hdr: '',
      });
    });

    it('gets the right values for a DLS string with 10 parameters', function () {
      let goDLSSampleString = "goDLS('/doc1/152129714885','496493','','1','','','','','',''); " + 'return(false)';
      expect(PACER.parseGoDLSFunction(goDLSSampleString)).toEqual({
        hyperlink: '/doc1/152129714885',
        de_caseid: '496493',
        de_seqno: '',
        got_receipt: '1',
        pdf_header: '',
        pdf_toggle_possible: '',
        magic_num: '',
        claim_id: '',
        claim_num: '',
        claim_doc_seq: '',
      });
    });

    it('returns false for an invalid DLS string', function () {
      expect(PACER.parseGoDLSFunction('not a goDLS function call')).toBe(null);
    });

    it('returns false for a null DLS input', function () {
      expect(PACER.parseGoDLSFunction(null)).toBe(null);
    });

    it('returns false for an undefined DLS input', function () {
      expect(PACER.parseGoDLSFunction(undefined)).toBe(null);
    });
  });

  describe('hasPacerCookie', function () {
    const loggedInCookie = 'PacerSession=B7yuvmcj2F...9p5nDzEXsHE; ' + 'PacerPref=receipt=Y';
    const altLoggedInCookie = 'PacerUser=B7yuvmcj2F...9p5nDzEXsHE; ' + 'PacerPref=receipt=Y';
    const nonLoggedInCookie = 'PacerSession=unvalidated; PacerPref=receipt=Y';
    const nonsenseCookie = 'Foo=barbaz; Baz=bazbar; Foobar=Foobar';

    it('returns true for a valid logged in cookie', function () {
      expect(PACER.hasPacerCookie(loggedInCookie)).toBe(true);
    });

    it('returns true for an alternate valid logged in cookie', function () {
      expect(PACER.hasPacerCookie(altLoggedInCookie)).toBe(true);
    });

    it('returns false for a non-logged in cookie', function () {
      expect(PACER.hasPacerCookie(nonLoggedInCookie)).toBe(false);
    });

    it('returns false for nonsense cookie', function () {
      expect(PACER.hasPacerCookie(nonsenseCookie)).toBe(false);
    });
  });

  describe('isAppellateCourt', function () {
    it('returns true for an appellate court', function () {
      expect(PACER.isAppellateCourt('ca5')).toBe(true);
    });

    it('returns false for a non-appellate court', function () {
      expect(PACER.isAppellateCourt('pawd')).toBe(false);
    });

    it('returns false for patent nonsense', function () {
      expect(PACER.isAppellateCourt('pingpong')).toBe(false);
    });
  });

  describe('isIQuerySummaryURL', function () {
    it('returns true for an iquery url with query string', function () {
      expect(PACER.isIQuerySummaryURL('https://ecf.mied.uscourts.gov/cgi-bin/iquery.pl?184987019171527-L_1_0-1')).toBe(
        true
      );
    });

    it('returns false for an iquery url without query string', function () {
      expect(PACER.isIQuerySummaryURL('https://ecf.mied.uscourts.gov/cgi-bin/iquery.pl')).toBe(false);
    });

    it('returns false for an url not related to the iquery pages', function () {
      expect(PACER.isIQuerySummaryURL(docketReportURL)).toBe(false);
    });
  });

  describe('getCaseIdFromIQuerySummary', function () {
    describe('for documents with matching format', function () {
      beforeEach(function () {
        let main_div = InputContainer();
        let table = document.createElement('table');
        let tbody = document.createElement('tbody');
        let tr = document.createElement('tr');
        let td = document.createElement('td');
        let anchor = document.createElement('a');
        anchor.href = 'cgi-bin/qryDocument.pl?360406';
        td.appendChild(anchor);
        tr.appendChild(td);
        tbody.appendChild(tr);
        table.appendChild(tbody);
        main_div.appendChild(table);
        document.body.appendChild(main_div);
        document.querySelector = jasmine.createSpy('querySelector').and.callFake(() => {
          return table;
        });
      });

      afterEach(function () {
        document.querySelector = jasmine.createSpy('querySelector').and.callThrough();
      });

      it('returns the case id', function () {
        expect(PACER.getCaseIdFromIQuerySummary()).toBe('360406');
      });
    });

    describe('for documents which have not matching format', function () {
      beforeEach(function () {
        let main_div = InputContainer();
        let table = document.createElement('table');
        main_div.appendChild(table);
        document.body.appendChild(main_div);
        document.querySelector = jasmine.createSpy('querySelector').and.callFake(() => {
          return table;
        });
      });

      afterEach(function () {
        document.querySelector = jasmine.createSpy('querySelector').and.callThrough();
      });

      it('returns null', function () {
        expect(PACER.getCaseIdFromIQuerySummary()).toBe(null);
      });
    });
  });

  describe('parseDoDocPostURL', function () {
    it('gets the right values for an example doDoc string', function () {
      let goDLSSampleString = "return doDocPostURL('009032024698','318547');";
      expect(PACER.parseDoDocPostURL(goDLSSampleString)).toEqual({
        doc_id: '009032024698',
        case_id: '318547',
      });
    });

    it('returns false for an invalid string', function () {
      expect(PACER.parseGoDLSFunction('not a goDLS function call')).toBeNull();
    });

    it('returns false for a null input', function () {
      expect(PACER.parseGoDLSFunction(null)).toBeNull();
    });

    it('returns false for an undefined input', function () {
      expect(PACER.parseGoDLSFunction(undefined)).toBeNull();
    });
  });

  describe('normalizeDashes', function () {
    it('can convert dashes nicely', function () {
      let tests = {
        'en dash –': 'en dash -', // En-dash
        'em dash —': 'em dash -', // Em-dash
        'dash -': 'dash -', // Regular dash
      };
      for (const [key, value] of Object.entries(tests)) {
        expect(PACER.normalizeDashes(key)).toBe(value);
      }
    });
  });

  describe('makeDocketNumberCore', function () {
    it('works as expected', function () {
      let expected = '1201032';

      expect(PACER.makeDocketNumberCore('2:12-cv-01032-JKG-MJL')).toBe(expected);
      expect(PACER.makeDocketNumberCore('12-cv-01032-JKG-MJL')).toBe(expected);
      expect(PACER.makeDocketNumberCore('2:12-cv-01032')).toBe(expected);
      expect(PACER.makeDocketNumberCore('12-cv-01032')).toBe(expected);

      // Do we automatically zero-pad short docket numbers?
      expect(PACER.makeDocketNumberCore('12-cv-1032')).toBe(expected);

      // bankruptcy numbers
      expect(PACER.makeDocketNumberCore('12-33112')).toBe('12033112');
      expect(PACER.makeDocketNumberCore('12-00001')).toBe('12000001');
      expect(PACER.makeDocketNumberCore('12-0001')).toBe('12000001');
      expect(PACER.makeDocketNumberCore('06-10672-DHW')).toBe('06010672');

      // docket_number fields can be null. If so, the core value should be
      // an empty string.
      expect(PACER.makeDocketNumberCore(null)).toBe('');
    });
  });

  describe('cleanDocLinkNumber', function () {
    it('can remove whitespace nicely', function () {
      let tests = {
        ' 89 ': '89',
        '&nbsp;89&nbsp;': '89',
        ' &nbsp; 89 &nbsp; ': '89',
        ' &nbsp;89&nbsp; ': '89',
        '&nbsp; 89 &nbsp;': '89',
        ' 89': '89',
        '89 ': '89',
      };
      for (const [key, value] of Object.entries(tests)) {
        expect(PACER.cleanDocLinkNumber(key)).toBe(value);
      }
    });
  });

  describe('getDocNumberFromAnchor', function () {
    it('can get number as expected', function () {
      let anchor = document.createElement('a');
      anchor.innerHTML = '&nbsp;89&nbsp;';
      expect(PACER.getDocNumberFromAnchor(anchor)).toBe('89');
    });

    it('returns null if the anchor shows an image', function () {
      let anchor = document.createElement('a');
      let img = document.createElement('img');
      anchor.appendChild(img);
      expect(PACER.getDocNumberFromAnchor(anchor)).toBeNull();
    });
  });

  describe('getAttachmentNumberFromAnchor', function () {
    it('returns 0 if the table has less than four columns', function () {
      let tr = document.createElement('tr');
      let anchor_td = document.createElement('td');
      let anchor = document.createElement('a');
      anchor_td.appendChild(anchor);
      tr.appendChild(document.createElement('td'));
      tr.appendChild(anchor_td);
      tr.appendChild(document.createElement('td'));
      expect(PACER.getAttachmentNumberFromAnchor(anchor)).toBe(0);
    });

    it('returns the attachment number if the table uses checkboxes', function () {
      let tr = document.createElement('tr');

      let number_td = document.createElement('td');
      number_td.innerHTML = '5';

      let anchor_td = document.createElement('td');
      let anchor = document.createElement('a');
      anchor_td.appendChild(anchor);

      tr.appendChild(document.createElement('td'));
      tr.appendChild(number_td);
      tr.appendChild(anchor_td);
      tr.appendChild(document.createElement('td'));
      tr.appendChild(document.createElement('td'));
      expect(PACER.getAttachmentNumberFromAnchor(anchor)).toBe('5');
    });

    it('returns the attachment number if the table does not have checkboxes', function () {
      let tr = document.createElement('tr');

      let number_td = document.createElement('td');
      number_td.innerHTML = '4';

      let anchor_td = document.createElement('td');
      let anchor = document.createElement('a');
      anchor_td.appendChild(anchor);

      tr.appendChild(number_td);
      tr.appendChild(anchor_td);
      tr.appendChild(document.createElement('td'));
      tr.appendChild(document.createElement('td'));
      expect(PACER.getAttachmentNumberFromAnchor(anchor)).toBe('4');
    });
  });
});
