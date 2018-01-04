describe('The PACER module', function() {
  var nonsenseUrl = 'http://something.uscourts.gov/foobar/baz';
  var docketQueryUrl = 'https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?531316';
  var altDocketQueryUrl = ('https://ecf.canb.uscourts.gov/cgi-bin/' +
                           'HistDocQry.pl?531316');
  var docketDisplayUrl = ('https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?' +
                          '101092135737069-L_1_0-1');
  var altDocketDisplayUrl = ('https://ecf.canb.uscourts.gov/cgi-bin/' +
                             'HistDocQry.pl?101092135737069-L_1_0-1');
  var singleDocUrl = 'https://ecf.canb.uscourts.gov/doc1/034031424909';
  var convertibleDocUrl = ('https://ecf.canb.uscourts.gov/cgi-bin/show_doc/' +
                           '034031424909');
  var loggedInCookie = ('PacerSession=B7yuvmcj2F...9p5nDzEXsHE; ' +
                        'PacerPref=receipt=Y');
  var altLoggedInCookie = ('PacerUser=B7yuvmcj2F...9p5nDzEXsHE; ' +
                           'PacerPref=receipt=Y');
  var nonLoggedInCookie = ('PacerSession=unvalidated; PacerPref=receipt=Y');
  var nonsenseCookie = ('Foo=barbaz; Baz=bazbar; Foobar=Foobar')

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

    it('returns false for a non-document court URL', function() {
      expect(PACER.isDocumentUrl(docketQueryUrl)).toBe(false);
    });

    it('returns false for patent nonsense', function() {
      expect(PACER.isDocumentUrl(nonsenseUrl)).toBe(false);
    });
  });

  describe('isConvertibleDocumentUrl', function() {
    it('matches a valid convertible document URL', function() {
      expect(PACER.isConvertibleDocumentUrl(convertibleDocUrl)).toBe(true);
    });

    it('returns false for a  non-converitble document URL', function() {
      expect(PACER.isConvertibleDocumentUrl(singleDocUrl)).toBe(false);
    });

    it('returns false for a non-document court URL', function() {
      expect(PACER.isConvertibleDocumentUrl(docketQueryUrl)).toBe(false);
    });

    it('returns false for patent nonsense', function() {
      expect(PACER.isConvertibleDocumentUrl(nonsenseUrl)).toBe(false);
    });
  });

  describe('isDocketQueryUrl', function() {
    it('matches a valid docket query URL', function() {
      expect(PACER.isDocketQueryUrl(docketQueryUrl)).toBe(true);
    });

    it('matches another valid docket query URL', function() {
      expect(PACER.isDocketQueryUrl(altDocketQueryUrl)).toBe(true);
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
      expect(PACER.getCaseNumberFromUrl(docketQueryUrl)).toBe('531316');
    });

    it('returns null for a document URL', function() {
      expect(PACER.getCaseNumberFromUrl(singleDocUrl)).toBe(null);
    });

    it('returns null for patent nonsense', function() {
      expect(PACER.getCaseNumberFromUrl(nonsenseUrl)).toBe(null);
    });
  });

  describe('isDocketDisplayUrl', function() {
    it('matches a docket display URL', function() {
      expect(PACER.isDocketDisplayUrl(docketDisplayUrl)).toBe(true);
    });

    it('matches another docket display URL', function() {
      expect(PACER.isDocketDisplayUrl(altDocketDisplayUrl)).toBe(true);
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

    it('coerces the fourth digit to zero', function() {
      fourthSetUrl = singleDocUrl.replace('034031424909', '034131424909')
      expect(PACER.getDocumentIdFromUrl(fourthSetUrl)).toBe('034031424909');
    });
  });

  describe('getBaseNameFromUrl', function() {
    it('gets the proper basename for a docket URL', function() {
      expect(PACER.getBaseNameFromUrl(docketQueryUrl)).toBe('DktRpt.pl');
    });

    it('gets the proper basename for a document URL', function() {
      expect(PACER.getBaseNameFromUrl(singleDocUrl)).toBe('034031424909')
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
