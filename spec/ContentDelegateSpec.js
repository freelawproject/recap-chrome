describe('The ContentDelegate class', function() {
  var docketQueryUrl = 'https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?531591';
  var nonsenseUrl = 'http://something.uscourts.gov/foobar/baz';

  beforeEach(function() {
    jasmine.Ajax.install();
  });

  afterEach(function() {
    jasmine.Ajax.uninstall();
  });

  function setupChromeSpy() {
    window.chrome = {      
      extension: {
        getURL: jasmine.createSpy()
      }
    }
  }
  
  function removeChromeSpy() {
    delete window.chrome;
  }


  it('gets created with a url, court and casenum', function() {
    var expected_url = 'https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?531591';
    var expected_court = 'canb';
    var expected_casenum = '531591';

    var cd = new ContentDelegate(
      expected_url, expected_court, expected_casenum);
    expect(cd.url).toBe(expected_url);
    expect(cd.court).toBe(expected_court);
    expect(cd.casenum).toBe(expected_casenum);
  });

  describe('handleDocketQueryUrl', function() {
    beforeEach(function() {
      setupChromeSpy();
      var form = document.createElement('form');
      document.body.appendChild(form);
    });

    afterEach(function() {
      removeChromeSpy();
      var form = document.getElementsByTagName('FORM')[0];
      form.parentNode.removeChild(form);
    });

    it('has no effect when not on a docket query url', function() {
      var cd = new ContentDelegate(nonsenseUrl, null, null);
      spyOn(cd.recap, 'getAvailabilityForDocket');
      cd.handleDocketQueryUrl();
      expect(cd.recap.getAvailabilityForDocket).not.toHaveBeenCalled();
    });

    it('inserts the RECAP banner on an appropriate page', function() {
      var cd = new ContentDelegate(docketQueryUrl, 'canb', '531591');
      cd.handleDocketQueryUrl();
      jasmine.Ajax.requests.mostRecent().respondWith({
        'status': 200,
        'contentType': 'application/json',
        'responseText': ('{"timestamp": "04\/16\/15", "docket_url": ' +
                         '"http:\/\/www.archive.org\/download\/gov.uscourts.' +
                         'canb.531591\/gov.uscourts.canb.531591.docket.html"}')
      });
      var banner = document.querySelector('.recap-banner');
      expect(banner).not.toBeNull();
      expect(banner.innerHTML).toContain('04/16/15');
      var link = banner.querySelector('a');
      expect(link).not.toBeNull();
      expect(link.href).toBe('http://www.archive.org/download/gov.uscourts.' +
                             'canb.531591/gov.uscourts.canb.531591.docket.html')
    });

    it('has no effect when on a docket query that has no RECAP', function() {
      var cd = new ContentDelegate(docketQueryUrl, 'canb', '531591');
      cd.handleDocketQueryUrl();
      jasmine.Ajax.requests.mostRecent().respondWith({
        'status': 200,
        'contentType': 'application/json',
        'responseText': '{}'
      });
      var banner = document.querySelector('.recap-banner');
      expect(banner).toBeNull();
    });
  });
});
