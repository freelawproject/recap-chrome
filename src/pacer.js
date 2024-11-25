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
//                                  |--> Possible interstitial large docket page
//                                  |
//                                  |
//                                  '--> Docket, i.e. list of documents or
//                                       History Report (*)
//                                        |
//                                        |--> Attachment menu page for a
//                                        |    particular document (aka doc1
//                                        |    page.
//                                        |     |
//                                        `-----'--> Single document page
//                                              |     |
//                                              |      '--> PDF view page (*)
//                                              |
//                                              |--> All documents zip page
//                                                   |
//                                                   '--> Zip file download page (*)
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
  // Returns the court identifier for a given URL, or null if not a
  // PACER, CM/ECF, or ACMS site.
  getCourtFromUrl: function (url) {
    // This function is used as a security check to ensure that no components of
    // RECAP are being used outside of PACER/ECF/ACMS. Be sure tests
    // pass appropriately before tweaking these regexes.
    if (!url) { return null; }

    let match;
    // CM/ECF and PACER
    match = url.toLowerCase().match(
      /^\w+:\/\/(ecf|pacer)\.(\w+)(?:\.audio)?\.uscourts\.gov(?:\/.*)?$/);
    if (match) { return match[2]; }

    // ACMS
    match = url.toLowerCase().match(
      /^\w+:\/\/(\w+)-showdoc\.azurewebsites\.us(?:\/.*)?$/);
    if (match) { return match[1]; }

    return null;
  },

  isACMSWebsite: function(url){
    return url.toLowerCase().includes('azurewebsites.us');
  },

  // Returns true if the URL is for the login page
  isLoginPage: function (url) {
    isPacerLogin = this.getCourtFromUrl(url) === 'login' && url.includes('csologin/login.jsf');
    // matches the URL for the login page to the Manage My Account interface in PACER. The url is:
    // https://pacer.psc.uscourts.gov/pscof/login.xhtml
    isManageAccountLogin = this.getCourtFromUrl(url) === 'psc' && url.includes('pscof/login.xhtml');
    return isPacerLogin || isManageAccountLogin;
  },

  convertToCourtListenerCourt: function(pacer_court_id) {
    return PACER_TO_CL_IDS[pacer_court_id] || pacer_court_id;
  },

  // Returns true if the given URL looks like a link to a PACER document.
  isDocumentUrl: function (url) {
    // This function will return true for the following URLs:
    //
    //  - Claims:
    //    - /cgi-bin/show_doc.pl?caseid=171908&claim_id=15151763&claim_num=7-1&magic_num=MAGIC
    //    - /doc1/072035305573?caseid=671949&claim_id=34489904&claim_num=28-1&magic_num=MAGIC&pdf_header=1
    //
    //  - Docket entry:
    //	  - /cgi-bin/show_doc.pl?caseid=171908&de_seq_num=981&dm_id=15184563&doc_num=287
    //    - /doc1/150014580417
    //    - /docs1/00205695758
    //
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

  // Returns true if the given URL is a doc1 link.
  isDoc1Url: function (url) {
    // This function will return true for the following URLs:
    //
    // For CMECF District:
    //   https://ecf.dcd.uscourts.gov/doc1/04503837920
    // For CMECF Appellate:
    //   https://ecf.ca2.uscourts.gov/docs1/00205695758
    //
    if (url.match(/\/(?:doc1|docs1)\/\d+/) && PACER.getCourtFromUrl(url)) {
      return true;
    }
    return false;
  },

  getCaseIdFromClaimsPage: function (document) {
    const links = [...document.querySelectorAll('a')];
    const docketLink = links.find(link => link.href.match(/DktRpt\.pl/));
    if (docketLink) {
      const match = docketLink.href.match(/\?\d+/)
      return match[0].slice(1);
    }
  },

  normalizeDashes: (text) =>{
    // Convert en & em dash(es) to hyphen(s)
    let normal_dash = "-";
    let en_dash = "–";
    let em_dash = "—";
    let hyphen = "‐";
    let non_breaking_hyphen = "‑";
    let figure_dash = "‒";
    let horizontal_bar = "―";
    return text.replace(
        new RegExp(`[${en_dash}${em_dash}${hyphen}${non_breaking_hyphen}${figure_dash}${horizontal_bar}]+`),
        normal_dash);
  },

  makeDocketNumberCore: function(docket_number){
    // Make a core docket number from an existing docket number.
    //
    // Converts docket numbers like:
    //
    //    2:12-cv-01032
    //    12-cv-01032
    //    12-332
    //
    // Into:
    //
    //    1201032 

    if (!docket_number){
      return "";
    }

    docket_number = this.normalizeDashes(docket_number);

    district_m = docket_number.match(/(?:\d:)?(\d\d)-..-(\d+)/);
    if (district_m){
      return `${district_m[1]}${district_m[2].padStart(5,0)}`;
    }
        
    bankr_m = docket_number.match(/(\d\d)-(\d+)/);
    if (bankr_m){
      //Pad to six characters because some courts have a LOT of bankruptcies
      return `${bankr_m[1]}${bankr_m[2].padStart(6,0)}`;
    }

    return "";
  },
  
  // Returns true if the URL is for docket query page.
  isDocketQueryUrl: function (url) {
    // There are two pages that use the DktRpt.pl url that we want to match:
    //  - The docket query page: /DktRpt.pl?115206
    //  - The docket report page: /DktRpt.pl?caseNumber=1:17-cv-10577&caseId=0
    // 
    // And one page that uses DktRpt.pl that we don't want to match:
    //  - The docket page itself: /DktRpt.pl?591030040473392-L_1_0-1
    // 
    // Thus, this regex matches URLs that have a query string with only digits
    // or that has one or multiple parameters separated by the ampersand ("&").
    //
    // This function will return true for the following URLs:
    //  - DktRpt.pl?365816
    //  - DktRpt.pl?caseNumber=4:19-cr-00820-SRC-1
    //  - DktRpt.pl?caseNumber=1:17-cv-10577&caseId=0
    //
    // But false for:
    //  - /DktRpt.pl?591030040473392-L_1_0-1
    //
    return !!url.match(/\/(DktRpt|HistDocQry)\.pl\?(\d+|(&?[\w]+=[^&=\n]+)+)$/);
  },

  // Returns true if the URL is for the manage account page.
  isManageAccountPage: function(url){
    // matches URLs related to the manage Manage My Account page in PACER. The url is:
    //  https://pacer.psc.uscourts.gov/pscof/manage/maint.jsf
    return /pacer./.test(url) && /manage/.test(url)
  },

  // Returns true if the URL is for the iquery summary page.
  isIQuerySummaryURL: function(url){
    // The URL for the iquery summary page shows a list of possibles reports related 
    // to a case in CM/ECF and has the word "iquery.pl" in it, also has a query string 
    // with numbers, a letter and hyphens, so this method will return true when the url 
    // is similar to the following one:
    //
    //    https://ecf.mied.uscourts.gov/cgi-bin/iquery.pl?135881001931855-L_1_0-1

    return /iquery.pl/.test(url) && /[\d_-]+[A-Z]+[\d_-]+/.test(url)
  },

  // Remove banners inserted by the extension
  removeBanners: ()=>{
    let banners = document.querySelectorAll('.recap-banner, .recap-filing-button');
    banners.forEach(banner => { banner.remove(); });
  },

  // Returns true if the URL is for the iQuery page.
  isBlankQueryReportUrl: function(url){
    // The URL for the query form used in CM/ECF to search cases is:
    //
    //    https://ecf.mied.uscourts.gov/cgi-bin/iquery.pl
    //
    // and the URL for list of possibles reports related to a case that is found with   
    // the query form is:
    //
    //   https://ecf.mied.uscourts.gov/cgi-bin/iquery.pl?900473201618068-L_1_0-1
    // 
    // This function checks if the URL has a query string and is related to the iQuery form. 
    // It will return true only when the url match the format of the first example and it will
    // exclude pages that include the iquery word but has a query string like the last example.
  
    return /iquery.pl/.test(url) && !/[?&]/.test(url)
  },

  // Returns true if the page contains a Transaction Receipt table
  hasTransactionReceipt: function(){
    return !!$('th>font:contains("Transaction Receipt")').length;
  },

  // Returns true if the receipts are disabled globally
  areTransactionReceiptsDisabled: function(cookie){
    return cookie && cookie.value.match(/receipt=N/)
  },
  
  // Returns true if the description in the Transaction Receipt table is 'Search'
  isSearchPage: function(){
    return this.hasTransactionReceipt && !!$('td>font:contains(Search)').length;
  }, 

  // Returns true if the user reaches the 'Select a Person' page
  isSelectAPersonPage: function(){
    // when a user tries to search a case using the first/middle/last name in the iquery form
    // they might get redirected to a list of matching people before they reach the list of cases
    // related to that name. The pacer_case_id cannot be extracted from the HTML elements on this page
    //
    // This function checks the description in the transaction receipt and the title of the page to
    // to identify the 'select a person' page.
  
    let title = document.querySelector('#cmecfMainContent>h2');
    return this.isSearchPage() && /Select a Person/i.test(title.innerHTML);
  },

  // Returns true if the user reaches the 'Case selection' page.
  isCaseQueryAdvance: function(){
    // In district court PACER, the users usually reach the case selection page directly if they avoid 
    // using the first/middle/last name fields in the iquery form, they reach the select a person page  
    // otherwise.
    //
    // In bankruptcy court PACER, the users always reach this page after they submit the iquery form.
    //
    // We should upload this page because the pacer_case_id can be extracted from the HTML for each case
    //
    // This function uses the description in the transaction receipt and the title of the page to
    // to identify the 'select a case' page.

    let title = document.querySelector('#cmecfMainContent>h2');
    return this.isSearchPage() && /Select a Case/i.test(title.innerHTML);
  },

  // Returns the URL with the case id as a query parameter. This function makes
  // sure every URL related to the Docket report has the same format
  formatDocketQueryUrl: function(url, case_id){
    // The ContentDelegate class expects a URL like the following:
    //
    //    https://ecf.dcd.uscourts.gov/cgi-bin/DktRpt.pl?178502
    //
    // The case id is found after the start of the query string (after the '?') in 
    // the previous URL, but the URL for the docket report accessed through the reports
    // menu doesn’t have a query string so one example of that URL is:
    //
    //   https://ecf.dcd.uscourts.gov/cgi-bin/DktRpt.pl
    // 
    // This function checks if the URL has a query string and is related to the docket 
    // report. if the URL has the same format as the first example, the function will return
    // the same URL but, for those URL like the last example, it will append the query string 
    // separator and the case id to make sure every URL has the format expected by the  
    // ContentDelegate class
    if (!/DktRpt.pl/.test(url)){ return url }

    return /[?&]/.test(url) ? url : `${url}?${case_id}`
  },


  // Returns true if the given URL is for a docket display page (i.e. the page
  // after submitting the "Docket Sheet" query page).
  isDocketDisplayUrl: function (url) {
    // The part after the "?" has hyphens in it.
    //   https://ecf.dcd.uscourts.gov/cgi-bin/DktRpt.pl?591030040473392-L_1_0-1
    if (url.match(/\/DktRpt\.pl\?\w+-[\w-]+$/)) { return true; }
    return false;
  },

  // Returns true if the given URL is for a docket history display page.
  isDocketHistoryDisplayUrl: function (url) {
    return !!url.match(/\/HistDocQry\.pl\?\w+-[\w-]+$/);
  },

  // Returns true if this is a "Document Selection Menu" page (a list of the
  // attachments for a particular document).
  isAttachmentMenuPage: function (url, document) {
    let inputs = document.querySelectorAll("input[type=button]");
    let bigFile = document.getElementById('file_too_big')
    let buttonText = inputs.length ? inputs[inputs.length - 1].value.includes('Download') : false
    let mainContent = document.getElementById("cmecfMainContent");
    // End this function early if we're on a management PACER page
    if (!mainContent){ return false }
    let paragraphs = mainContent.getElementsByTagName("p");
    let topNote = paragraphs.length ? paragraphs[0].textContent.includes('Document Selection Menu') : false
    let bottomNote = mainContent.lastChild.textContent.includes('view each document individually');
    let pageCheck = PACER.isDocumentUrl(url) && ( 
      !!buttonText || !!bigFile || !!topNote || !!bottomNote);
    return !!pageCheck;
  },

  // Returns true if this is a "Download Documents" page (confirmation of
  // pricing for all documents to receive a zip file with all of them)
  isDownloadAllDocumentsPage: function(url, document) {
    let inputs = document.getElementsByTagName("input");
    let pageCheck =
      !!url.match(/\/show_multidocs\.pl\?/) &&
      inputs.length &&
      inputs[inputs.length-1].value === "Download Documents"
    return !!pageCheck
  },
  
  // Returns true if this is a combined PDF page (confirmation of
  // pricing for all documents to receive a combined PDF file with
  // all of them)
  isCombinedPdfPage: function (url, document) {
    // This method checks the page has the following elements:
    //  - The URL contains the "zipit" parameters and its value is 0
    //  - The URL contains the word "show_multidocs.pl"
    //  - shows 2 or more buttons
    let queryParameters = new URLSearchParams(window.location.search);
    let isZipFile = queryParameters.get('zipit');
    let buttons = document.getElementsByTagName('input');
    let pageCheck =
      !!url.match(/\/show_multidocs\.pl\?/) &&
      isZipFile == 0 &&
      buttons.length > 1 &&
      buttons[buttons.length - 1].value === 'View Document';

    return !!pageCheck;
  },
  
  // Claims Register Page includes an h2 tag with the court and words "Claims Register"
  // exampleUrl: https://ecf.nyeb.uscourts.gov/cgi-bin/SearchClaims.pl?610550152546515-L_1_0-1
  // exampleHeader: <h2>Eastern District of New York<br>Claims Register </h2>

  isClaimsRegisterPage: function (url, document) {
    let headlines = [...document.getElementsByTagName('h2')]
    let pageCheck =
      !!url.match(/\/SearchClaims\.pl\?/)
      && headlines.length > 0
      && headlines[0].innerText.match(/Claims Register/)
    return pageCheck
  },

  // Returns true if this is a page for downloading a single document.
  // district:
  //   https://ecf.dcd.uscourts.gov/doc1/04503837920
  // appellate:
  //   https://ecf.ca1.uscourts.gov/n/beam/servlet/TransportRoom?servlet=ShowDoc&dls_id=00107215565&caseId=41182&dktType=dktPublic
  isSingleDocumentPage: function (url, document) {
    let inputs = document.getElementsByTagName('input');
    let lastInput = inputs.length && inputs[inputs.length - 1].value;
    // If the receipt doesn't say "AUDIO", "Image" or "TRANSCRIPT"
    // we don't yet support it on the server.
    // So far, this only appears to apply to bankruptcy claims. This CSS
    // selector is duplicated in onDocumentViewSubmit.
    let hasAudioReceipt = !!$('td:contains(AUDIO)').length;
    let hasImageReceipt = !!$('td:contains(Image)').length;
    let hasTranscriptReceipt = !!$('td:contains(TRANSCRIPT)').length;


    let pageCheck = (PACER.isDocumentUrl(url) &&
                     (hasAudioReceipt || hasImageReceipt || hasTranscriptReceipt) &&
                     (lastInput === 'View Document') ||
                     (lastInput === 'Accept Charges and Retrieve'));
    debug(4,` lastInput ${lastInput}`);
    return !!pageCheck;
  },

  cleanPacerDocId: (pacer_doc_id)=>{
    // PACER sites use the fourth digit of the pacer_doc_id to flag whether
    // the user has been shown a receipt page.  We don't care about that, so
    // we always set the fourth digit to 0 when getting a doc ID.
    return `${pacer_doc_id.slice(0, 3)}0${pacer_doc_id.slice(4)}`;
  },

  // Returns the document ID for a document view page or single-document page.
  getDocumentIdFromUrl: function (url) {
    let match = (url || '').match(/\/(?:doc1|docs1)\/(\d+)/);
    if (match) {
      return this.cleanPacerDocId(match[1])
    }
  },

  // Returns the case ID for a queries list page.
  getCaseIdFromIQuerySummary: function(){
    let tableContainer = document.querySelector("#cmecfMainContent table");
    let anchors = tableContainer.getElementsByTagName("a");
    // End this function early if there are no anchor tags
    if (!anchors.length){ return null; }
    let lastAnchor = anchors[anchors.length-1]
    // the next sequence of statements will match the digits at the end of the href. 
    // The href attribute of the anchor tags in the table has the following format:
    //
    //    https://ecf.mied.uscourts.gov/cgi-bin/qryDocument.pl?360406
    //
    // We can grab the pacer case ID from this url if we get all the digits after the ?.
    
    let queryString = lastAnchor.href.match(/[\d]+/g);
    return queryString[queryString.length-1]
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
      if (hostname.endsWith('uscourts.gov')) {
        let match;
        for (let re of [
          // Appellate CMECF sends us some odd URLs, be aware:
          // https://ecf.mad.uscourts.gov/cgi-bin/DktRpt.pl?caseNumber=1:17-cv-11842-PBS&caseId=0
          // https://ecf.mad.uscourts.gov/cgi-bin/DktRpt.pl?caseNumber=1:17-cv-11842-PBS&caseId=1:17-cv-11842-PBS
          /[?&]caseid=(\d+)/i, // match on caseid GET param
          /\?(\d+)(?:&.*)?$/,  // match on DktRpt.pl?178502&blah urls
        ]){
          match = url.match(re);
          if (match){
            debug(3, `Found caseid via: ${match[0]}`);
            if (match[1] === '0'){
              // Appellate CMECF calls District CMECF with caseId=0 when it doesn't
              // know the caseid. Ignore that special case here.
              continue;
            }
            return match[1];
          }
        }
      }
    }
  },

  getCaseNumberFromInputs: function(url, document){
    if (PACER.isDocumentUrl(url)){
      let inputs = document.querySelectorAll("input[type=button]");
      let last_input = inputs[inputs.length -1];
      if (inputs.length && last_input.value.includes("Download")) {
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
    //                  pdf_header, pdf_toggle_possible, magic_num, hdr, psf_report)
    //
    // Bankruptcy courts provide ten parameters, instead of nine. These can
    // be found in unminified js:
    //   https://ecf.paeb.uscourts.gov/lib/dls_url.js
    // as:
    //   function goDLS(hyperlink, de_caseid, de_seqno, got_receipt,
    //                  pdf_header, pdf_toggle_possible, magic_num,
    //                  claim_id, claim_num, claim_doc_seq)
    // Δ:
    // - hdr
    // + claim_id, claim_num, claim_doc_seq
    let goDlsDistrict = /^goDLS\('([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)'\)/.exec(goDLS_string);
    let goDlsBankr= /^goDLS\('([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)'\)/.exec(goDLS_string);
    if (!goDlsDistrict && !goDlsBankr) {
      return null;
    }
    let r = {};
    if (goDlsDistrict){
      [, r.hyperlink, r.de_caseid, r.de_seqno, r.got_receipt, r.pdf_header,
        r.pdf_toggle_possible, r.magic_num, r.hdr, r.psf_report] = goDlsDistrict;
    } else {
      [, r.hyperlink, r.de_caseid, r.de_seqno, r.got_receipt, r.pdf_header,
        r.pdf_toggle_possible, r.magic_num, r.claim_id, r.claim_num,
        r.claim_doc_seq] = goDlsBankr;
    }
    return r;
  },

  // Parse the doDocPostURL function returning its parameters as a dict.
  parseDoDocPostURL: function(doDoc_string){
    // CMECF provides extra information on Document Links as arguments of the onclick event
    // handler called doDocPostURL(). This function is used in attachment pages and docket
    // reports. e.g.:
    //
    // In docket reports, CMECF passes the doc_id and the case_id as arguments
    //   return doDocPostURL('009031927529','318547');
    //
    // In attachment pages, CMECF passes only the doc_id as an argument
    //   return doDocPostURL('009131506511')
    //
    // this regex will match the doc_id and case_id passed as an argument in the
    // onclick event of each anchor element related to a document from Appellate Pacer.

    let doDocPost = /^return doDocPostURL\('([^']*)','([^']*)'\);/.exec(doDoc_string);
    let doDocPostAttachment = /^return doDocPostURL\('([^']*)'\)/.exec(doDoc_string);
    if (!doDocPost && !doDocPostAttachment) {
      return;
    }
    let params = {};
    if (doDocPost){
      [, params.doc_id, params.case_id] = doDocPost;
    }else{
      [, params.doc_id] = doDocPostAttachment;
      params.case_id = null 
    }
    return params;
  },

  // Given document.cookie, returns true if the user is logged in to PACER.
  hasPacerCookie: function (cookieString) {
    let cookies = {};
    cookieString.replace(/\s*([^=;]+)=([^;]*)/g, function (match, name, value) {
      cookies[name.trim()] = value.trim();
    });
    let pacerCookie = cookies['PacerUser'] || cookies['PacerSession'];
    return !!(pacerCookie && !pacerCookie.match(/unvalidated/));
  },

  // Given document.cookie, returns true if the user has filing rights.
  hasFilingCookie: function (cookieString){
    let filingCookie = cookieString.split('; ')
        .find((row) => row.startsWith('isFilingAccount'))
        ?.split('=')[1];
    return !!(filingCookie && filingCookie.match(/true/));
  },

  // Returns true if the given court identifier is for an appellate court.
  isAppellateCourt: function (court) {
    return PACER.APPELLATE_COURTS.includes(court);
  },

  removeAllBanners: () =>{
    let banners = document.querySelectorAll('.recap-banner')
    banners.forEach(banner => { banner.remove() });
  },
  
  // returns data from receipt table as an object
  parseDataFromReceipt: () => {
    // this method uses regex expressions to match that the docket number, document number and the attachment 
    // number from the receipt table and returns an object with the following attributes:
    //  - docket_number
    //  - doc_number
    //  - att_number
    
    let audio_string = $('td:contains(AUDIO)').text();
    let image_string = $('td:contains(Image)').text();
    let transcript_string = $('td:contains(TRANSCRIPT)').text();

    let receipt_description = image_string || audio_string || transcript_string;
    let regex = /(\d+)-(\d+)/;
    let matches = regex.exec(receipt_description);
    if (!matches) {
      return null;
    }
    let r = {};
    [ , r.doc_number, r.att_number] = matches;
    r.docket_number = $.trim($('tr:contains(Case Number) td:nth(1)').text());

    return r;
  },

  // returns HTML to create a full page iframe that loads the url passed as an argument
  makeFullPageIFrame: (url) => {
    return `<style>body { margin: 0; padding: 0; height: 100%; overflow: hidden; } iframe { border: none; }</style> 
            <div class='full-page-iframe'>
            <iframe src="${url}" width="100%" height="100%" frameborder="0"></iframe>
            </div>`;
  },

  // removes whitespace and returns a number
  cleanDocLinkNumber: (number) => {
    // Converts links numbers like:
    //  -  89 
    //  - &nbsp;89&nbsp;
    //  - &nbsp; 89 &nbsp; 
    //
    // into:
    //
    //  - 89

    let match = /(?:\s*(?:&nbsp;)?\s*)(\d+)(?:\s*(?:&nbsp;)?\s*)/.exec(number);
    if (!match) {
      return null;
    }
    return match[1];
  },

  // return the document number of a document link 
  getDocNumberFromAnchor: function (anchor) {
    // Document links from the full docket report and the general docket  
    // report take the following shape (most of the time): 
    // 
    //  <a
    //    href="https://ecf.cafc.uscourts.gov/docs1/01301646325"
    //    onclick="return doDocPostURL('01301646325','16239');"
    //    title="Open Document"
    //  >
    //    &nbsp;1&nbsp;
    //  </a>
    //  
    // This method returns the number inside the anchor tag without whitespace

    if (anchor.childElementCount) {
      // Pacer pages that have docket entry number turned off show an 
      // image inside the anchor element. We want to avoid these cases.
      return null;
    }

    return this.cleanDocLinkNumber(anchor.innerHTML);
  },

  // returns the attachment number of a document link
  getAttachmentNumberFromAnchor: function (anchor) {
    //  The attachment number is not inside the anchor tag that has the document link as in
    //  the docket report, but We can get this number if we access the row that contains the 
    //  link. Each row of the attachment menu has the following information:
    //  
    //   - A checkbox (optional, not all attachment tables has this checkbox)
    //   - The Attachment number  
    //   - The document Link
    //   - A description 
    //   - The number of pages
    //   - File size (optional)
    //
    //  Each row of the docket report has the following information:
    //
    //   - filed date
    //   - docket entry number
    //   - A description
    //    
    //  We can use the number of elements per row to group the possible cases:
    //
    //  - Rows with 3 or less elements belong to a docket report. 
    //  - Rows with four, five or more elements belong to an attachment menu.
    //
    //  This method accesses the tr element that contains the document link, checks the number
    //  of elements inside this tag (we want to exclude rows from docket reports) and returns the 
    //  attachment number of the document.

    let row = anchor.parentNode.parentNode;
    if (row.childElementCount <= 3) {
      // Attachment menu pages should have more than 3 element per row.
      return null;
    }

    //  If the attachment page uses checkboxes, each row should have five or six child nodes and the attachment
    //  number should be inside the second one(the first node has the checkbox). Attachment pages that does
    //  not have checkboxes shows the attachment number inside the first child node.

    let rowNumber = [5,6].includes(row.childElementCount) ? row.childNodes[1].innerHTML : row.childNodes[0].innerHTML;
    let cleanNumber = this.cleanDocLinkNumber(rowNumber);
    return cleanNumber ? cleanNumber : null;
  },

  handleDocketAvailabilityMessages: (resultCount) =>{
    if (resultCount === 0) {
      console.warn('RECAP: Zero results found for docket lookup.');
    } else if (resultCount > 1) {
      console.error(`RECAP: More than one result found for docket lookup. Found ${resultCount}`);
    }
  },

  addRecapBannerToLoginPage: (message, link) => {
    let headerContainer = document.getElementById('pscHeaderContainer');
    let banner_div = document.createElement('div');

    let banner_wrapper = document.createElement('div');
    banner_wrapper.id = 'recap_info_banner';
    banner_wrapper.classList.add('recap-login-banner');

    let banner_icon_container = document.createElement('div');
    banner_icon_container.classList.add('banner-icon-container');

    let recap_icon = document.createElement('img');
    recap_icon.src = chrome.runtime.getURL('assets/images/icon-48.png');
    recap_icon.style.width = '40px';
    recap_icon.style.height = '40px';
    banner_icon_container.appendChild(recap_icon);

    let banner_message_wrapper = document.createElement('div');
    banner_message_wrapper.classList.add('banner-message-wrapper')

    let banner_text = document.createElement('p');
    banner_text.innerHTML = message;

    banner_message_wrapper.appendChild(banner_text);

    let banner_button = document.createElement('a');
    banner_button.id = 'learn_more_btn';
    banner_button.classList.add('btn');
    banner_button.classList.add('btn-primary');
    banner_button.classList.add('banner-open-btn');
    banner_button.innerHTML = 'Learn More';
    banner_button.href = link;
    banner_button.target = '_blank';
    banner_button.rel = 'noopener';

    let dismiss_button = document.createElement('a');
    dismiss_button.classList.add('banner-close-btn');
    dismiss_button.id = 'dismiss_recap_info_banner'
    dismiss_button.href = 'javascript:void(0);';
    dismiss_button.innerHTML = '<span aria-hidden="true">&times;</span>';

    banner_wrapper.appendChild(banner_icon_container);
    banner_wrapper.appendChild(banner_message_wrapper);
    banner_wrapper.appendChild(banner_button);
    banner_wrapper.appendChild(dismiss_button);
    banner_div.appendChild(banner_wrapper);

    headerContainer.after(banner_div);
  },
  
  removeBannerFromLoginPage: async (event_from_btn = false) => {
    // Updates user preferences and remove the information banner
    let info_banner = document.getElementById('recap_info_banner');
    info_banner.remove();

    let options = await getItemsFromStorage('options');
    if (event_from_btn) {
      options['option_dismiss_new_brand_info'] = true;
      options['dismiss_news_badge'] = true;
    }
    options['login_dismiss_new_brand_info'] = true;
    saveItemToStorage({ options: options });
  },

  // These are all the supported PACER court identifiers, together with their
  // West-style court name abbreviations.
  COURT_ABBREVS: {
    // Appellate Courts
    'ca1': '1st-Cir.',
    'ca2': '2d-Cir.',
    'ca3': '3rd-Cir.',
    'ca4': '4th-Cir.',
    'ca5': '5th-Cir.',
    'ca6': '6th-Cir.',
    'ca7': '7th-Cir.',
    'ca8': '8th-Cir.',
    'ca9': '9th-Cir.',
    'ca10': '10th-Cir.',
    'ca11': '11th-Cir.',
    'cadc': 'D.C.-Cir.',
    'cafc': 'Fed.-Cir.',
    // District Courts
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
  APPELLATE_COURTS: ['ca1', 'ca2', 'ca3', 'ca4', 'ca5', 'ca6', 'ca7', 'ca8', 'ca9', 'ca10', 'ca11', 'cadc', 'cafc']
};
