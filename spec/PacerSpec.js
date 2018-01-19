describe('The PACER module', function() {
  var nonsenseUrl = 'http://something.uscourts.gov/foobar/baz';
  var docketQueryUrl = ('https://ecf.canb.uscourts.gov/cgi-bin/' +
                           'HistDocQry.pl?531316');
  var docketDisplayUrl = ('https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?' +
                          '101092135737069-L_1_0-1');
  var appellateDocketDisplayUrl = (
    'https://ecf.ca1.uscourts.gov/n/beam/servlet/TransportRoom?' +
    'servlet=CaseSummary.jsp&caseNum=16-1567&incOrigDkt=Y&incDktEntries=Y'
  );
  var singleDocUrl = 'https://ecf.canb.uscourts.gov/doc1/034031424909';
  var appellateDocumentUrl = 'https://ecf.ca2.uscourts.gov/docs1/00205695758';
  var showDocUrl = ('https://ecf.cacd.uscourts.gov/cgi-bin/show_doc.pl?' +
                    'caseid=560453&de_seq_num=24&dm_id=15521444&doc_num=7');
  var loggedInCookie = ('PacerSession=B7yuvmcj2F...9p5nDzEXsHE; ' +
                        'PacerPref=receipt=Y');
  var altLoggedInCookie = ('PacerUser=B7yuvmcj2F...9p5nDzEXsHE; ' +
                           'PacerPref=receipt=Y');
  var nonLoggedInCookie = ('PacerSession=unvalidated; PacerPref=receipt=Y');
  var nonsenseCookie = ('Foo=barbaz; Baz=bazbar; Foobar=Foobar');
  var goDLSSampleString = ('goDLS(\'/doc1/09518360046\',\'153992\',\'264\',' +
                           '\'\',\'\',\'1\',\'\',\'\'); return(false);');

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

  describe('isDocumentUrl', function() {
    it('matches a valid document URL', function() {
      expect(PACER.isDocumentUrl(singleDocUrl)).toBe(true);
    });

    it('matches a valid appellate document URL', function() {
      expect(PACER.isDocumentUrl(appellateDocumentUrl)).toBe(true);
    });

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
  });

  describe('isDocketDisplayUrl', function() {
    it('matches a docket display URL', function() {
      expect(PACER.isDocketDisplayUrl(docketDisplayUrl)).toBe(true);
    });

    it('returns true for a valid appellate docket URL', function() {
      expect(PACER.isDocketDisplayUrl(appellateDocketDisplayUrl)).toBe(true);
    });

    it('returns false for a docket query URL', function() {
      expect(PACER.isDocketDisplayUrl(docketQueryUrl)).toBeUndefined();
    });

    it('returns false for a document URL', function() {
      expect(PACER.isDocketDisplayUrl(singleDocUrl)).toBeUndefined();
    });

    it('returns false for patent nonsense', function() {
      expect(PACER.isDocketDisplayUrl(nonsenseUrl)).toBeUndefined();
    });
  });

  var inputContainer = document.createElement('div');
  inputContainer.id = 'input-cont';
  document.body.appendChild(inputContainer);
  function appendInputWithValue(value) {
    var input = document.createElement('input');
    input.value = value;
    document.getElementById('input-cont').appendChild(input);
  }

  describe('isAttachmentMenuPage', function() {
    describe('for documents with a matching input', function() {
      beforeEach(function() {
        appendInputWithValue('Download All');
      });

      afterEach(function() {
        document.getElementById('input-cont').innerHTML = '';
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
        appendInputWithValue('Download One');
        appendInputWithValue('Download Some');
      });

      afterEach(function() {
        document.getElementById('input-cont').innerHTML = '';
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
        appendInputWithValue('View Document');
      });

      afterEach(function() {
        document.getElementById('input-cont').innerHTML = '';
      });

      it('returns true when the URL is valid', function() {
        expect(PACER.isSingleDocumentPage(singleDocUrl, document)).toBe(true);
      });

      it('return false when the URL is invalid', function() {
        expect(
          PACER.isSingleDocumentPage(docketQueryUrl, document)).toBe(false);
      });
    });

    describe('for documents which have non-matching inputs', function() {
      beforeEach(function() {
        appendInputWithValue('Download One');
        appendInputWithValue('Download Some');
      });

      afterEach(function() {
        document.getElementById('input-cont').innerHTML = '';
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
    it('returns true for a valid logged in cookie', function() {
      expect(PACER.hasPacerCookie(loggedInCookie)).toBe(true);
    });

    it('returns true for an alternate valid logged in cookie', function() {
      expect(PACER.hasPacerCookie(altLoggedInCookie)).toBe(true);
    });

    it('returns false for a non-logged in cookie', function() {
      expect(PACER.hasPacerCookie(nonLoggedInCookie)).toBe(false);
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
