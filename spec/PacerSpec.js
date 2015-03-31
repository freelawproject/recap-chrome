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

  describe('isAttachmentMenuPage', function() {
    describe('for documents which meet the requirements', function() {
      var inputContainer = document.createElement('div');
      inputContainer.id = 'input-cont';
      document.body.appendChild(inputContainer);

      beforeEach(function() {
        var input = document.createElement('input');
        input.value = "Download All";
        document.getElementById('input-cont').appendChild(input);
      });

      it('returns true when the URL is valid', function() {
        expect(PACER.isAttachmentMenuPage(singleDocUrl, document)).toBe(true);
      });

      it('returns false when the URL is invalid', function() {
        expect(
          PACER.isAttachmentMenuPage(docketQueryUrl, document)).toBe(false);
      });

      afterEach(function() {
        document.getElementById('input-cont').innerHTML = '';
      });
    });


    it('returns false with a valid URL', function() {
      expect(PACER.isAttachmentMenuPage(singleDocUrl, document)).toBe(false);
    });
  });
});
