// -------------------------------------------------------------------------
// Abstraction of PACER site and services.  This file is browser-independent.


// PACER websites are structured like this:
//
// Case query form
//  |
//  `--> Main menu for a particular case
//        |
//        |--> Docket query form ---.
//        |                         |
//        `--> History query form --|
//                                  |
//                                  '--> Docket, i.e. list of documents or
//                                       History Report (*)
//                                        |
//                                        |--> Attachment menu page for a
//                                        |    particular document (aka doc1
//                                        |    page.
//                                        |     |
//                                        `-----'--> Single document page
//                                                    |
//                                                    '--> PDF view page (*)
//
// Pages marked (*) cost money.  The "Single document page" is a page that
// tells you how much a document will cost before you get to view the PDF.

let PACER_TO_CL_IDS = {
    'azb': 'arb',         // Arizona Bankruptcy Court
    'cofc': 'uscfc',      // Court of Federal Claims
    'neb': 'nebraskab',   // Nebraska Bankruptcy
    'nysb-mega': 'nysb'   // Remove the mega thing
};

// Public constants and pure functions.  As these are pure, they can be freely
// called from anywhere; by convention we use an ALL_CAPS name to allude to
// the purity (const-ness) of this object's contents.
let PACER = {
  // Returns the court identifier for a given URL, or null if not a PACER site.
  getCourtFromUrl: function (url) {

    let courtRegexps = new Array (
      /^\w+:\/\/(ecf|ecf-train|pacer)\.(\w+)\.uscourts\.gov\//,
      /^\w+:\/\/(efiling)\.uscourts\.(cavc)\.gov\//
    );

    let match;

    for (let re of courtRegexps) {
      match = (url || '').toLowerCase().match(re);
      if (match) {
        let servlet = match[1];
        break;
      }
    }

    return match ? match[2] : null;
  },

  convertToCourtListenerCourt: function(pacer_court_id) {
    return PACER_TO_CL_IDS[pacer_court_id] || pacer_court_id;
  },

  // Returns true if the given URL looks like a link to a PACER document.
  // For CMECF District:
  //   https://ecf.dcd.uscourts.gov/doc1/04503837920
  // For CMECF Appellate:
  //   https://ecf.ca2.uscourts.gov/docs1/00205695758
  // TODO: implement related logic for appellate
  isDocumentUrl: function (url) {
    if (
        url.match(/\/(?:doc1|docs1)\/\d+/) ||
        url.match(/\/cgi-bin\/show_doc/) ||
        url.match(/servlet=ShowDoc/)
    ) {
      if (PACER.getCourtFromUrl(url)) {
        return true;
      }
    }
    return false;
  },

  // Returns true if the URL is for docket query page.
  isDocketQueryUrl: function (url) {
    debug(4, "checking isDocketQueryUrl");
    // The part after the "?" is all digits.
    return !!url.match(/\/(DktRpt|HistDocQry)\.pl\?\d+$/);
    // TODO: make above match for appellate (and implement related logic)
  },

  // Returns true if the given URL is for a docket display page (i.e. the page
  // after submitting the "Docket Sheet" query page).
  isDocketDisplayUrl: function (url) {
    // The part after the "?" has hyphens in it.
    //   https://ecf.dcd.uscourts.gov/cgi-bin/DktRpt.pl?591030040473392-L_1_0-1
    // Appellate:
    //   https://ecf.ca1.uscourts.gov/n/beam/servlet/TransportRoom?servlet=CaseSummary.jsp&caseNum=16-1567&incOrigDkt=Y&incDktEntries=Y
    if (url.match(/\/DktRpt\.pl\?\w+-[\w-]+$/)) { return true; }

    // Regular expression to match on Appellate pages, and if a
    // servlet is specified, to return it as a captured group.
    // If no servlet is specified, it's returned as undefined, which
    // is properly handled in the switch block.
    //
    // The RE is a bit complicated, so let's break it down:
    //
    //   servlet\/TransportRoom # 1: The string servlet/TransportRoom
    //   (?:\?servlet=          # 2: An OPTIONAL, TERMINAL, NON-CAPTURING
    //                          #    group that contains ?servlet=
    //     ([^?&]+)             # 3: A CAPTURING group of >1 non-? or &
    //                          #    chars, as they'd delimit another
    //                          #    url parameter.
    //     (?:[\/&#;].*)?       # 4: An OPTIONAL, NON-CAPTURING group of a
    //                          #    /, &, #, or ; char, followed by
    //                          #    anything at all, which would be
    //                          #    one or more url parameters.
    //   )?                     # Closing of (2) and making it optional
    //   $                      # Making (2) terminal
    //
    // xxx: This would match on
    //   https://ecf.ca1.uscourts.gov/n/beam/underservlet/
    // xxx: This presumes ?servlet= is the first parameter, would fail on
    //   /servlet/TransportRoom?caseId=44381&servlet=DocketReportFilter.jsp
    // xxx: This will if a terminal slash precedes the parameter section:
    //   /servlet/TransportRoom/?...
    let re = /servlet\/TransportRoom(?:\?servlet=([^?&]+)(?:[\/&#;].*)?)?$/;
    let match = url.match(re);
    if (match) {
      let servlet = match[1];
      debug(4, `Identified appellate servlet ${servlet} at ${url}`);

      switch(servlet) {
        case 'CaseSummary.jsp':
        case 'ShowPage': // what is this?
        case undefined:
          return true;

        default:
          debug(4, `Assuming servlet ${servlet} is not a docket.`);
        case 'CaseSearch.jsp':
        case 'ShowDoc':
        case 'ShowDocMulti':
        case 'CaseSelectionTable':
        case 'CourtInfo.jsp':
        case 'DocketReportFilter.jsp':
        case 'InvalidUserLogin.jsp':
        case 'OrderJudgment.jsp':
        case 'PACERCalendar.jsp':
        case 'PacerHelp.jsp':
        case 'PACEROpinion.jsp':
        case 'Login':
        case 'k2aframe.jsp': // attorney/java?
        case 'k2ajnlp.jsp':
        case 'RSSGenerator': // maybe we should upload rss?
        case 'PaymentHistory':
        case 'ChangeClient.jsp':
          return false;
      }
    } else {
      debug(4, "No appellate match for" + url);
    }
  },

  // Returns true if the given URL is for a docket history display page.
  isDocketHistoryDisplayUrl: function (url) {
    return !!url.match(/\/HistDocQry\.pl\?\w+-[\w-]+$/);
  },

  // Returns true if this is a "Document Selection Menu" page (a list of the
  // attachments for a particular document).
  isAttachmentMenuPage: function (url, document) {
    let inputs = document.getElementsByTagName('input');
    let pageCheck = PACER.isDocumentUrl(url) &&
      inputs.length &&
      inputs[inputs.length - 1].value === 'Download All';
    return !!pageCheck;
  },

  // Returns true if this is a page for downloading a single document.
  // district:
  //   https://ecf.dcd.uscourts.gov/doc1/04503837920
  // appellate:
  //   https://ecf.ca1.uscourts.gov/n/beam/servlet/TransportRoom?servlet=ShowDoc&dls_id=00107215565&caseId=41182&dktType=dktPublic
  isSingleDocumentPage: function (url, document) {
    let inputs = document.getElementsByTagName('input');
    let lastInput = inputs.length && inputs[inputs.length - 1].value;
    // If the receipt doesn't say "Image" we don't yet support it on the server.
    // So far, this only appears to apply to bankruptcy claims. This CSS
    // selector is duplicated in onDocumentViewSubmit.
    let hasImageReceipt = !!$('td:contains(Image)').length;
    let pageCheck = (PACER.isDocumentUrl(url) &&
                     hasImageReceipt &&
                     (lastInput === 'View Document') ||
                     (lastInput === 'Accept Charges and Retrieve'));
    debug(4," lastInput "+lastInput);
    return !!pageCheck;
  },

  // Returns the document ID for a document view page or single-document page.
  getDocumentIdFromUrl: function (url) {
    let match = (url || '').match(/\/(?:doc1|docs1)\/(\d+)/);
    if (match) {
      // PACER sites use the fourth digit of the pacer_doc_id to flag whether
      // the user has been shown a receipt page.  We don't care about that, so
      // we always set the fourth digit to 0 when getting a doc ID.
      return match[1].slice(0, 3) + '0' + match[1].slice(4);
    }
  },

  // Get the document ID for a document view page using the "View Document"
  // form.
  getDocumentIdFromForm: function(url, document){
    if (PACER.isDocumentUrl(url)) {
      let inputs = document.getElementsByTagName('input');
      let last_input = inputs[inputs.length - 1];
      if (inputs.length && last_input.value === 'View Document') {
        // Grab the document ID from the form's onsubmit attribute
        let onsubmit = last_input.form.getAttribute('onsubmit');
        let goDLS = PACER.parseGoDLSFunction(onsubmit);
        return goDLS && PACER.getDocumentIdFromUrl(goDLS.hyperlink);
      }
    }
  },

  // Given a URL that satisfies isDocketQueryUrl, gets its case number.
  getCaseNumberFromUrls: function (urls) {
    // Iterate over an array of URLs and get the case number from the
    // first one that matches. Because the calling function may pass us URLs
    // other than the page URL, such as referrers, we narrow to
    // *uscourts.gov. (Page URLs are so limited by the "include_globs" in
    // manifest.json; but referrers are not.)
    for (let url of urls) {
      let hostname = getHostname(url);
      // JS is trash. It lacks a way of getting the TLD, so we use endsWith.
      if (hostname.endsWith('uscourts.gov')||hostname.endsWith('cavc.gov')) {
        for (let re of [
          // Appellate CMECF sends us some odd URLs, be aware:
          // https://ecf.mad.uscourts.gov/cgi-bin/DktRpt.pl?caseNumber=1:17-cv-11842-PBS&caseId=0
          // https://ecf.mad.uscourts.gov/cgi-bin/DktRpt.pl?caseNumber=1:17-cv-11842-PBS&caseId=1:17-cv-11842-PBS
          /[?&]caseid=(\d+)/i, // match on caseid GET param
          /\?(\d+)(?:&.*)?$/,  // match on DktRpt.pl?178502&blah urls
        ]){
          let match = url.match(re);
          if (match){
            debug(3, "Found caseid via: " + match[0]);
            if (match[1] === '0'){
              // Appellate CMECF calls District CMECF with caseId=0 when it doesn't
              // know the caseid. Ignore that special case here.
              continue;
            }
            return match[1];
          }
        }
        // xxx does not match style above.
        let match;
        if (match = url.match(/[?&]caseNum=([-\d]+)/)) {
          // Appellate. Actually this is a docket number. Uhoh? xxx
          debug(3, "Found caseNum via: " + match[0]);
          return match[1];
        } else if (match = url.match(/[?&]caseId=([-\d]+)/)) {
          debug(3, "Found caseId via: " + match[0]);
          // Also seen in appellate. Note upppercase 'I' and hyphens. Actual caseID. xxx
          return match[1];
        }
        debug(4, "Couldn't find case number via getCaseNumberFromUrls");
      }
    }
  },

  getCaseNumberFromInputs: function(url, document){
    if (PACER.isDocumentUrl(url)){
      let inputs = document.getElementsByTagName('input');
      let last_input = inputs[inputs.length -1];
      if (inputs.length && last_input.value === "Download All") {
        // Attachment page.
        let onclick = last_input.getAttribute("onclick");
        let match = onclick.match(/[?&]caseid=(\d+)/i);
        if (match && match[1] !== '0'){
          return match[1];
        }
      } else if (inputs.length && last_input.value === "View Document") {
        // Download receipt page.
        let onsubmit = last_input.form.getAttribute("onsubmit");
        let goDLS = PACER.parseGoDLSFunction(onsubmit);
        return goDLS && goDLS.de_caseid;
      }
    }
  },

  // Gets the last path component of a URL.
  getBaseNameFromUrl: function (url) {
    return url.replace(/\?.*/, '').replace(/.*\//, '');
  },

  // Parse the goDLS function returning its parameters as a dict.
  parseGoDLSFunction: function (goDLS_string){
    // CMECF provides extra information on Document Links (DLS?) in the goDLS()
    // function of an onclick handler, e.g.:
    //
    //   <a href="https://ecf.mad.uscourts.gov/doc1/09518360046"
    //      onclick="goDLS('/doc1/09518360046','153992','264','','','1','','');
    //               return(false);">95</a>
    //
    // This is similarly used in the onsubmit function of some forms.
    //
    // The parameters are defined in the unminified js
    //   https://ecf.flnd.uscourts.gov/lib/dls_url.js
    // as:
    //   function goDLS(hyperlink, de_caseid, de_seqno, got_receipt,
    //                  pdf_header, pdf_toggle_possible, magic_num, hdr)
    let goDLS = /^goDLS\('([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)'\)/.exec(goDLS_string);
    if (!goDLS) {
      return null;
    }
    let r = {};
    [, r.hyperlink, r.de_caseid, r.de_seqno, r.got_receipt, r.pdf_header,
      r.pdf_toggle_possible, r.magic_num, r.hdr] = goDLS;
    return r;
  },

  // Given document.cookie, returns true if the user is logged in to PACER.
  hasPacerCookie: function (cookieString) {
    let cookies = {};
    cookieString.replace(/\s*([^=;]+)=([^;]*)/g, function (match, name, value) {
      cookies[name.trim()] = value.trim();
    });
    let pacerCookie = cookies['PacerUser'] || cookies['PacerSession'] || cookies['CMECFASESSIONID'];
    return !!(pacerCookie && !pacerCookie.match(/unvalidated/));
  },

  // Returns true if the given court identifier is for an appellate court.
  isAppellateCourt: function (court) {
    return !!PACER.APPELLATE_COURTS[court];
  },

  // These are all the supported PACER court identifiers, together with their
  // West-style court name abbreviations.
  COURT_ABBREVS: {
    'akb': 'Bankr.D.Alaska',
    'akd': 'D.Alaska',
    'almb': 'Bankr.M.D.Ala.',
    'almd': 'M.D.Ala.',
    'alnb': 'Bankr.N.D.Ala.',
    'alnd': 'N.D.Ala.',
    'alsb': 'Bankr.S.D.Ala.',
    'alsd': 'S.D.Ala.',
    'areb': 'Bankr.E.D.Ark.',
    'ared': 'E.D.Ark.',
    'arwb': 'Bankr.W.D.Ark.',
    'arwd': 'W.D.Ark.',
    'azb': 'Bankr.D.Ariz.',
    'azd': 'D.Ariz.',
    'cacb': 'Bankr.C.D.Cal.',
    'cacd': 'C.D.Cal.',
    'caeb': 'Bankr.E.D.Cal.',
    'caed': 'E.D.Cal.',
    'canb': 'Bankr.N.D.Cal.',
    'cand': 'N.D.Cal.',
    'casb': 'Bankr.S.D.Cal.',
    'casd': 'S.D.Cal.',
    'cit': 'CIT',
    'cob': 'Bankr.D.Colo.',
    'cod': 'D.Colo.',
    'cofc': 'Fed.Cl.',
    'ctb': 'Bankr.D.Conn.',
    'ctd': 'D.Conn.',
    'dcb': 'Bankr.D.D.C.',
    'dcd': 'D.D.C.',
    'deb': 'Bankr.D.Del.',
    'ded': 'D.Del.',
    'flmb': 'Bankr.M.D.Fla.',
    'flmd': 'M.D.Fla.',
    'flnb': 'Bankr.N.D.Fla.',
    'flnd': 'N.D.Fla.',
    'flsb': 'Bankr.S.D.Fla.',
    'flsd': 'S.D.Fla.',
    'gamb': 'Bankr.M.D.Ga.',
    'gamd': 'M.D.Ga.',
    'ganb': 'Bankr.N.D.Ga.',
    'gand': 'N.D.Ga.',
    'gasb': 'Bankr.S.D.Ga.',
    'gasd': 'S.D.Ga.',
    'gub': 'Bankr.D.Guam',
    'gud': 'D.Guam',
    'hib': 'Bankr.D.Hawaii',
    'hid': 'D.Hawaii',
    'ianb': 'Bankr.N.D.Iowa',
    'iand': 'N.D.Iowa',
    'iasb': 'Bankr.S.D.Iowa',
    'iasd': 'S.D.Iowa',
    'idb': 'Bankr.D.Idaho',
    'idd': 'D.Idaho',
    'ilcb': 'Bankr.C.D.Ill.',
    'ilcd': 'C.D.Ill.',
    'ilnb': 'Bankr.N.D.Ill.',
    'ilnd': 'N.D.Ill.',
    'ilsb': 'Bankr.S.D.Ill.',
    'ilsd': 'S.D.Ill.',
    'innb': 'Bankr.N.D.Ind.',
    'innd': 'N.D.Ind.',
    'insb': 'Bankr.S.D.Ind.',
    'insd': 'S.D.Ind.',
    'ksb': 'Bankr.D.Kan.',
    'ksd': 'D.Kan.',
    'kyeb': 'Bankr.E.D.Ky.',
    'kyed': 'E.D.Ky.',
    'kywb': 'Bankr.W.D.Ky.',
    'kywd': 'W.D.Ky.',
    'laeb': 'Bankr.E.D.La.',
    'laed': 'E.D.La.',
    'lamb': 'Bankr.M.D.La.',
    'lamd': 'M.D.La.',
    'lawb': 'Bankr.W.D.La.',
    'lawd': 'W.D.La.',
    'mab': 'Bankr.D.Mass.',
    'mad': 'D.Mass.',
    'mdb': 'Bankr.D.Md.',
    'mdd': 'D.Md.',
    'meb': 'Bankr.D.Me.',
    'med': 'D.Me.',
    'mieb': 'Bankr.E.D.Mich.',
    'mied': 'E.D.Mich.',
    'miwb': 'Bankr.W.D.Mich.',
    'miwd': 'W.D.Mich.',
    'mnb': 'Bankr.D.Minn.',
    'mnd': 'D.Minn.',
    'moeb': 'Bankr.E.D.Mo.',
    'moed': 'E.D.Mo.',
    'mowb': 'Bankr.W.D.Mo.',
    'mowd': 'W.D.Mo.',
    'msnb': 'Bankr.N.D.Miss',
    'msnd': 'N.D.Miss',
    'mssb': 'Bankr.S.D.Miss.',
    'mssd': 'S.D.Miss.',
    'mtb': 'Bankr.D.Mont.',
    'mtd': 'D.Mont.',
    'nceb': 'Bankr.E.D.N.C.',
    'nced': 'E.D.N.C.',
    'ncmb': 'Bankr.M.D.N.C.',
    'ncmd': 'M.D.N.C.',
    'ncwb': 'Bankr.W.D.N.C.',
    'ncwd': 'W.D.N.C.',
    'ndb': 'Bankr.D.N.D.',
    'ndd': 'D.N.D.',
    'neb': 'Bankr.D.Neb.',
    'ned': 'D.Neb.',
    'nhb': 'Bankr.D.N.H.',
    'nhd': 'D.N.H.',
    'njb': 'Bankr.D.N.J.',
    'njd': 'D.N.J.',
    'nmb': 'Bankr.D.N.M.',
    'nmd': 'D.N.M.',
    'nmid': 'N.MarianaIslands',
    'nvb': 'Bankr.D.Nev.',
    'nvd': 'D.Nev.',
    'nyeb': 'Bankr.E.D.N.Y.',
    'nyed': 'E.D.N.Y.',
    'nynb': 'Bankr.N.D.N.Y.',
    'nynd': 'N.D.N.Y.',
    'nysb': 'Bankr.S.D.N.Y.',
    'nysb-mega': 'Bankr.S.D.N.Y.',
    'nysd': 'S.D.N.Y.',
    'nywb': 'Bankr.W.D.N.Y.',
    'nywd': 'W.D.N.Y.',
    'ohnb': 'Bankr.N.D.Ohio',
    'ohnd': 'N.D.Ohio',
    'ohsb': 'Bankr.S.D.Ohio',
    'ohsd': 'S.D.Ohio',
    'okeb': 'Bankr.E.D.Okla.',
    'oked': 'E.D.Okla.',
    'oknb': 'Bankr.N.D.Okla.',
    'oknd': 'N.D.Okla.',
    'okwb': 'Bankr.W.D.Okla.',
    'okwd': 'W.D.Okla.',
    'orb': 'Bankr.D.Or.',
    'ord': 'D.Or.',
    'paeb': 'Bankr.E.D.Pa.',
    'paed': 'E.D.Pa.',
    'pamb': 'Bankr.M.D.Pa.',
    'pamd': 'M.D.Pa.',
    'pawb': 'Bankr.W.D.Pa.',
    'pawd': 'W.D.Pa.',
    'prb': 'Bankr.D.P.R.',
    'prd': 'D.P.R.',
    'rib': 'Bankr.D.R.I.',
    'rid': 'D.R.I.',
    'scb': 'Bankr.D.S.C.',
    'scd': 'D.S.C.',
    'sdb': 'Bankr.D.S.D.',
    'sdd': 'D.S.D.',
    'tneb': 'Bankr.E.D.Tenn.',
    'tned': 'E.D.Tenn.',
    'tnmb': 'Bankr.M.D.Tenn.',
    'tnmd': 'M.D.Tenn.',
    'tnwb': 'Bankr.W.D.Tenn.',
    'tnwd': 'W.D.Tenn.',
    'txeb': 'Bankr.E.D.Tex.',
    'txed': 'E.D.Tex.',
    'txnb': 'Bankr.N.D.Tex.',
    'txnd': 'N.D.Tex.',
    'txsb': 'Bankr.S.D.Tex.',
    'txsd': 'S.D.Tex.',
    'txwb': 'Bankr.W.D.Tex.',
    'txwd': 'W.D.Tex.',
    'utb': 'Bankr.D.Utah',
    'utd': 'D.Utah',
    'vaeb': 'Bankr.E.D.Va.',
    'vaed': 'E.D.Va.',
    'vawb': 'Bankr.W.D.Va.',
    'vawd': 'W.D.Va.',
    'vib': 'Bankr.D.VirginIslands',
    'vid': 'D.VirginIslands',
    'vtb': 'Bankr.D.Vt.',
    'vtd': 'D.Vt.',
    'waeb': 'Bankr.E.D.Wash.',
    'waed': 'E.D.Wash.',
    'wawb': 'Bankr.W.D.Wash.',
    'wawd': 'W.D.Wash.',
    'wieb': 'Bankr.E.D.Wis.',
    'wied': 'E.D.Wis.',
    'wiwb': 'Bankr.W.D.Wis',
    'wiwd': 'W.D.Wis',
    'wvnb': 'Bankr.N.D.W.Va.',
    'wvnd': 'N.D.W.Va.',
    'wvsb': 'Bankr.S.D.W.Va.',
    'wvsd': 'S.D.W.Va.',
    'wyb': 'Bankr.D.Wyo.',
    'wyd': 'D.Wyo.'
  },

  // PACER court identifiers for appellate courts.
  APPELLATE_COURTS: {
    'ca1': 1,
    'ca2': 1,
    'ca3': 1,
    'ca4': 1,
    'ca5': 1,
    'ca6': 1,
    'ca7': 1,
    'ca8': 1,
    'ca9': 1,
    'ca10': 1,
    'ca11': 1,
    'cadc': 1,
    'cafc': 1,
    'cavc': 1
  }
};
