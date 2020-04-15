describe('The PACER module', function() {
  const nonsenseUrl = 'http://something.uscourts.gov/foobar/baz';
  const docketQueryUrl = ('https://ecf.canb.uscourts.gov/cgi-bin/' +
    'HistDocQry.pl?531316');
  const singleDocUrl = 'https://ecf.canb.uscourts.gov/doc1/034031424909';
  const appellateDocumentUrl = 'https://ecf.ca2.uscourts.gov/docs1/00205695758';

  function addInputContainer() {
    const inputContainer = document.createElement('div');
    inputContainer.id = 'input-cont';
    document.body.appendChild(inputContainer);
  }

  function removeInputContainer() {
    document.getElementById('input-cont').remove();
  }

  function appendInputWithValue(value) {
    const input = document.createElement('input');
    input.value = value;
    document.getElementById('input-cont').appendChild(input);
  }

  describe('getCourtFromUrl', function() {
    it('matches a valid docket query URL', function() {
      expect(PACER.getCourtFromUrl(docketQueryUrl)).toBe('canb');
    });

    it('matches a valid single doc URL', function() {
      expect(PACER.getCourtFromUrl(singleDocUrl)).toBe('canb');
    });

    it('ignores patent nonsense', function() {
      expect(PACER.getCourtFromUrl(nonsenseUrl)).toBe(null);
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

  describe('isDocumentUrl', function() {
    it('matches a valid document URL', function() {
      expect(PACER.isDocumentUrl(singleDocUrl)).toBe(true);
    });

    it('matches a valid appellate document URL', function() {
      expect(PACER.isDocumentUrl(appellateDocumentUrl)).toBe(true);
    });

    const showDocUrl = ('https://ecf.cacd.uscourts.gov/cgi-bin/show_doc.pl?' +
      'caseid=560453&de_seq_num=24&dm_id=15521444&doc_num=7');

    it('matches a valid show_doc document URL', function() {
      expect(PACER.isDocumentUrl(showDocUrl)).toBe(true);
    });

    it('returns false for a non-document court URL', function() {
      expect(PACER.isDocumentUrl(docketQueryUrl)).toBe(false);
    });

    it('returns false for patent nonsense', function() {
      expect(PACER.isDocumentUrl(nonsenseUrl)).toBe(false);
    });
  });

  describe('isDocketQueryUrl', function() {
    it('matches a valid docket query URL', function() {
      expect(PACER.isDocketQueryUrl(docketQueryUrl)).toBe(true);
    });

    it('returns false for a document URL', function() {
      expect(PACER.isDocketQueryUrl(singleDocUrl)).toBe(false);
    });

    it('returns false for patent nonsense', function() {
      expect(PACER.isDocketQueryUrl(nonsenseUrl)).toBe(false);
    });
  });

  describe('isDocketDisplayUrl', function() {
    const docketDisplayUrl = ('https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?' +
      '101092135737069-L_1_0-1');

    it('matches a docket display URL', function() {
      expect(PACER.isDocketDisplayUrl(docketDisplayUrl)).toBe(true);
    });

    const appellateDocketDisplayUrl = (
      'https://ecf.ca1.uscourts.gov/n/beam/servlet/TransportRoom?' +
      'servlet=CaseSummary.jsp&caseNum=16-1567&incOrigDkt=Y&incDktEntries=Y'
    );

    it('returns true for a valid appellate docket URL', function() {
      expect(PACER.isDocketDisplayUrl(appellateDocketDisplayUrl)).toBe(true);
    });

    it('returns false for a docket query URL', function() {
      expect(PACER.isDocketDisplayUrl(docketQueryUrl)).toBe(false);
    });

    it('returns false for a document URL', function() {
      expect(PACER.isDocketDisplayUrl(singleDocUrl)).toBe(false);
    });

    it('returns false for patent nonsense', function() {
      expect(PACER.isDocketDisplayUrl(nonsenseUrl)).toBe(false);
    });

    const caseDefault = 'https://ecf.ca1.uscourts.gov/n/beam/servlet/TransportRoom?' +
      'servlet=Nonsense.jsp';

    it('returns false for other jsp pages', function() {
      expect(PACER.isDocketDisplayUrl(caseDefault)).toBe(false);
    });

    const caseSearch = 'https://ecf.ca1.uscourts.gov/n/beam/servlet/TransportRoom?' +
      'servlet=CaseSearch.jsp';

    it('returns false for other jsp pages', function() {
      expect(PACER.isDocketDisplayUrl(caseSearch)).toBe(false);
    });
  });

  describe('isDocketHistoryDisplayUrl', function() {
    const historyUrl = 'https://ecf.ca1.uscourts.gov/HistDocQry.pl?fred-fred';
    it('should recognize a history url', function () {
      expect(PACER.isDocketHistoryDisplayUrl(historyUrl)).toBe(true);
    });
  });

  describe('isAttachmentMenuPage', function() {
    describe('for documents with a matching input', function() {
      beforeEach(function() {
        addInputContainer();
        appendInputWithValue('Download All');
      });

      afterEach(function() {
        removeInputContainer();
      });

      it('returns true when the URL is valid', function() {
        expect(PACER.isAttachmentMenuPage(singleDocUrl, document)).toBe(true);
      });

      it('returns false when the URL is invalid', function() {
        expect(
          PACER.isAttachmentMenuPage(docketQueryUrl, document)).toBe(false);
      });
    });

    describe('for documents which have non-matching inputs', function() {
      beforeEach(function() {
        addInputContainer();
        appendInputWithValue('Download One');
        appendInputWithValue('Download Some');
      });

      afterEach(function() {
        removeInputContainer();
      });

      it('returns false with valid URL', function() {
        expect(PACER.isAttachmentMenuPage(singleDocUrl, document)).toBe(false);
      });
    });

    it('returns false with a valid URL and non-matching document', function() {
      expect(PACER.isAttachmentMenuPage(singleDocUrl, document)).toBe(false);
    });
  });

  describe('isSingleDocumentPage', function() {
    describe('for documents with a matching input', function() {
      beforeEach(function() {
        addInputContainer();
        appendInputWithValue('View Document');
      });

      afterEach(function() {
        removeInputContainer();
      });

      it('returns true when the URL is valid', function() {
        let table = document.createElement('table');
        let tr_image = document.createElement('tr');
        let td_image = document.createElement('td');
        td_image.innerHTML = 'Image 1234-9876';
        tr_image.appendChild(td_image);
        table.appendChild(tr_image);
        document.body.appendChild(table);

        expect(PACER.isSingleDocumentPage(singleDocUrl, document)).toBe(true);
        table.remove();
      });

      it('return false when the URL is invalid', function() {
        expect(
          PACER.isSingleDocumentPage(docketQueryUrl, document)).toBe(false);
      });
    });

    describe('for documents which have non-matching inputs', function() {
      beforeEach(function() {
        addInputContainer();
        appendInputWithValue('Download One');
        appendInputWithValue('Download Some');
      });

      afterEach(function() {
        removeInputContainer();
      });

      it('returns false with valid URL', function() {
        expect(PACER.isSingleDocumentPage(singleDocUrl, document)).toBe(false);
      });
    });

    it('returns false with a valid URL and non-matching document', function() {
      expect(PACER.isAttachmentMenuPage(singleDocUrl, document)).toBe(false);
    });
  });

  describe('getDocumentIdFromUrl', function() {
    it('returns the correct document id for a valid URL', function() {
      expect(PACER.getDocumentIdFromUrl(singleDocUrl)).toBe('034031424909');
    });

    it('returns the correct document id for a valid appellate URL', function() {
      expect(PACER.getDocumentIdFromUrl(appellateDocumentUrl)).toBe('00205695758');
    });

    it('coerces the fourth digit to zero', function() {
      let fourthSetUrl = singleDocUrl.replace('034031424909', '034131424909');
      expect(PACER.getDocumentIdFromUrl(fourthSetUrl)).toBe('034031424909');
    });
  });

  describe('getDocumentIdFronForm', function () {
    const goDLS = "goDLS('/doc1/09518360046','153992','264','','','1','','');";

    beforeEach(function() {
      const form = document.createElement('form');
      document.body.appendChild(form);
      const input = document.createElement('input');
      form.append(input);
      form.setAttribute('onSubmit', goDLS);
      input.value = 'View Document';
    });

    afterEach(function() {
      document.getElementsByTagName('form')[0].remove();
    });

    it('should return document id', function () {
      expect(PACER.getDocumentIdFromForm(appellateDocumentUrl, document)).toBe('09508360046');
    });
  });

  describe('getCaseNumberFromUrl', function() {
    it('returns the right case number for a docket query URL', function() {
      expect(PACER.getCaseNumberFromUrls([docketQueryUrl])).toBe('531316');
    });

    it('returns null for a document URL', function() {
      expect(PACER.getCaseNumberFromUrls([singleDocUrl])).toBeUndefined();
    });

    it('returns null for patent nonsense', function() {
      expect(PACER.getCaseNumberFromUrls([nonsenseUrl])).toBeUndefined();
    });

    const cmecfUrl = ('https://ecf.cmecf.uscourts.gov/cgi-bin/' +
      'HistDocQry.pl?0');

    it('returns caseNum', function() {
      expect(PACER.getCaseNumberFromUrls([cmecfUrl])).toBeUndefined();
    });

    const caseNumUrl = ('https://ecf.canb.uscourts.gov/cgi-bin/' +
      'HistDocQry.pl?caseNum=44-29');

    it('returns caseNum', function() {
      expect(PACER.getCaseNumberFromUrls([caseNumUrl])).toBe('44-29');
    });
    // relies on the leading dash to test against /[?&]caseId=([-\d]+)/
    // instead of /[?&]caseid=(\d+)/i
    const caseIdUrl = ('https://ecf.canb.uscourts.gov/cgi-bin/' +
      'HistDocQry.pl?caseId=-6721');

    it('returns caseNum', function() {
      expect(PACER.getCaseNumberFromUrls([caseIdUrl])).toBe('-6721');
    });
  });

  describe('getCaseNumberFromInputs', function() {
    const goDLS = "goDLS('/doc1/09518360046','153992','264','','','1','','');";
    const input = document.createElement('input');

    beforeEach(function() {
      const form = document.createElement('form');
      document.body.appendChild(form);
      form.append(input);
      form.setAttribute('onSubmit', goDLS);
    });

    afterEach(function() {
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

  describe('getBaseNameFromUrl', function() {
    it('gets the proper basename for a docket URL', function() {
      expect(PACER.getBaseNameFromUrl(docketQueryUrl)).toBe('HistDocQry.pl');
    });

    it('gets the proper basename for a document URL', function() {
      expect(PACER.getBaseNameFromUrl(singleDocUrl)).toBe('034031424909')
    });
  });

  describe('parseGoDLSFunction', function(){
    it("gets the right values for an example DLS string", function() {
      let goDLSSampleString = "goDLS('/doc1/09518360046','153992','264','','','1','',''); " +
        "return(false);";
      expect(PACER.parseGoDLSFunction(goDLSSampleString)).toEqual({
        hyperlink: '/doc1/09518360046',
        de_caseid: '153992',
        de_seqno: '264',
        got_receipt: '',
        pdf_header: '',
        pdf_toggle_possible: '1',
        magic_num: '',
        hdr: ''
      });
    });


    it("gets the right values for a DLS string with 10 parameters", function(){
      let goDLSSampleString = "goDLS('/doc1/152129714885','496493','','1','','','','','',''); " +
        "return(false)";
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
      })
    });

    it("returns false for an invalid DLS string", function() {
      expect(PACER.parseGoDLSFunction("not a goDLS function call")).toBe(null);
    });

    it("returns false for a null DLS input", function() {
      expect(PACER.parseGoDLSFunction(null)).toBe(null);
    });

    it("returns false for an undefined DLS input", function() {
      expect(PACER.parseGoDLSFunction(undefined)).toBe(null);
    });
  });

  describe('hasPacerCookie', function() {
    const loggedInCookie = ('PacerSession=B7yuvmcj2F...9p5nDzEXsHE; ' +
      'PacerPref=receipt=Y');
    const altLoggedInCookie = ('PacerUser=B7yuvmcj2F...9p5nDzEXsHE; ' +
      'PacerPref=receipt=Y');
    const nonLoggedInCookie = ('PacerSession=unvalidated; PacerPref=receipt=Y');
    const nonsenseCookie = ('Foo=barbaz; Baz=bazbar; Foobar=Foobar');

    it('returns true for a valid logged in cookie', function() {
      expect(PACER.hasPacerCookie(loggedInCookie)).toBe(true);
    });

    it('returns true for an alternate valid logged in cookie', function() {
      expect(PACER.hasPacerCookie(altLoggedInCookie)).toBe(true);
    });

    it('returns false for a non-logged in cookie', function() {
      expect(PACER.hasPacerCookie(nonLoggedInCookie)).toBe(false);
    });

    it('returns false for nonsense cookie', function() {
      expect(PACER.hasPacerCookie(nonsenseCookie)).toBe(false);
    });
  });

  describe('isAppellateCourt', function() {
    it('returns true for an appellate court', function() {
      expect(PACER.isAppellateCourt('ca5')).toBe(true);
    });

    it('returns false for a non-appellate court', function() {
      expect(PACER.isAppellateCourt('pawd')).toBe(false);
    });

    it('returns false for patent nonsense', function() {
      expect(PACER.isAppellateCourt('pingpong')).toBe(false);
    });
  });
});
