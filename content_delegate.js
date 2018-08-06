// Abstraction of content scripts to make them modular and testable.

let ContentDelegate = function(url, path, court, pacer_case_id, pacer_doc_id,
                               links) {
  this.url = url;
  this.path = path;
  this.court = court;
  this.pacer_case_id = pacer_case_id;
  if (pacer_doc_id){
    this.pacer_doc_id = pacer_doc_id;
    this.pacer_doc_ids = [pacer_doc_id];
  } else {
    this.pacer_doc_ids = []
  }
  this.links = links || [];

  this.notifier = importInstance(Notifier);
  this.recap = importInstance(Recap);

  this.findAndStorePacerDocIds();
};

// Use a variety of approaches to get and store pacer_doc_id to pacer_case_id
// mappings in local storage.
ContentDelegate.prototype.findAndStorePacerDocIds = function() {
  console.info("ContentDelegate");
  if (!PACER.hasPacerCookie(document.cookie)) {
    console.info("returned out of ContentDelegate because no PACER cookie");
    return;
  }

  // Not all pages have a case ID, and there are corner-cases in merged dockets
  // where there are links to documents on another case.
  let page_pacer_case_id = this.pacer_case_id ||
    this.recap.getPacerCaseIdFromPacerDocId(this.pacer_doc_id, function(){});

  let docsToCases = {};

  // Try getting a mapping from a pacer_doc_id in the URL to a
  if (this.pacer_doc_id && page_pacer_case_id) {
    debug(3, 'Z doc ' + this.pacer_doc_id + ' to ' + page_pacer_case_id);
    docsToCases[this.pacer_doc_id] = page_pacer_case_id;
  }

  for (let i = 0; i < this.links.length; i++) {
    let link = this.links[i];
    if (PACER.isDocumentUrl(link.href)) {
      let pacer_doc_id = PACER.getDocumentIdFromUrl(link.href);
      $(link).data('pacer_doc_id', pacer_doc_id);
      this.pacer_doc_ids.push(pacer_doc_id);

      let onclick = link.getAttribute('onclick');
      let goDLS = PACER.parseGoDLSFunction(onclick);

      if (goDLS && goDLS.de_caseid) {
        docsToCases[pacer_doc_id] = goDLS.de_caseid;
        debug(3, 'Y doc ' + pacer_doc_id + ' to ' + goDLS.de_caseid);
      } else if (page_pacer_case_id) {
        docsToCases[pacer_doc_id] = page_pacer_case_id;
        debug(3,'X doc ' + pacer_doc_id + ' to '
              + page_pacer_case_id);
      }
    }
  }
  chrome.storage.local.set(docsToCases, function(){
    console.info(`RECAP: Saved the pacer_doc_id to pacer_case_id mappings to local ` +
                 `storage: ` + Object.keys(docsToCases).length);
  });
};

// If this is a docket query page, ask RECAP whether it has the docket page.
ContentDelegate.prototype.handleDocketQueryUrl = function() {
  if (!PACER.isDocketQueryUrl(this.url)) {
    return;
  }
  if (!PACER.hasPacerCookie(document.cookie)){
    // Logged out users that load a docket page, see a login page, so they
    // shouldn't check for docket availability.
    return;
  }

  this.recap.getAvailabilityForDocket(this.court, this.pacer_case_id,
                                      function (result) {
    if (result.count === 0){
      console.warn(`RECAP: Zero results found for docket lookup.`);
      return;
    } else if (!(result.count === 1)){
      console.error(`RECAP: More than one result found for docket lookup. Found ` +
                    `${result.count}`);
      return;
    }
    let first_result = result.results[0];

    // Insert a RECAP download link at the bottom of the form.
    $('<div class="recap-banner"/>').append(
      $('<a/>', {
        title: 'Docket is available for free in the RECAP Archive.',
        target: '_blank',
        href: "https://www.courtlistener.com" + first_result.absolute_url
      }).append(
        $('<img/>', {src: chrome.extension.getURL('assets/images/icon-16.png')})
      ).append(
        ' View and search this docket as of '
      ).append(
        $('<time/>', {
          "data-livestamp": first_result.date_modified,
          "title": first_result.date_modified,
        }).append(first_result.date_modified)
      ).append(
        ' for free from RECAP'
      )
    ).append(
      $('<br><small>Note that archived dockets may be out of date.</small>')
    ).appendTo($('form'));
  });
};

// If this is a docket page, upload it to RECAP.
ContentDelegate.prototype.handleDocketDisplayPage = function() {
  if (history.state && history.state.uploaded) {
    return;
  }
  let isDocketDisplayUrl = PACER.isDocketDisplayUrl(this.url);
  let isDocketHistoryDisplayUrl = PACER.isDocketHistoryDisplayUrl(this.url);
  if (!(isDocketHistoryDisplayUrl || isDocketDisplayUrl)) {
    // If it's not a docket display URL or a docket history URL, punt.
    return;
  }
  let isAppellate = PACER.isAppellateCourt(this.court);
  if (!this.pacer_case_id) {
    // If we don't have the pacer_case_id, punt.
    return;
  }

  chrome.storage.local.get('options', function (items) {
    if (!items['options']['recap_disabled']) {
      let callback = $.proxy(function (ok) {
        if (ok) {
          history.replaceState({uploaded: true}, '');
          this.notifier.showUpload(
            'Docket uploaded to the public RECAP Archive.',
            function(){}
          );
        }
      }, this);
      if (isDocketDisplayUrl){
        this.recap.uploadDocket(this.court, this.pacer_case_id,
          document.documentElement.innerHTML,
          (isAppellate?'APPELLATE_DOCKET':'DOCKET'),
          callback);
      } else if (isDocketHistoryDisplayUrl) {
        this.recap.uploadDocket(this.court, this.pacer_case_id,
          document.documentElement.innerHTML,
          'DOCKET_HISTORY_REPORT',
          callback);
      }
    } else {
      console.info(`RECAP: Not uploading docket. RECAP is disabled.`)
    }
  }.bind(this));
};

// If this is a document's menu of attachments (subdocuments), upload it to
// RECAP.
ContentDelegate.prototype.handleAttachmentMenuPage = function() {
  if (history.state && history.state.uploaded) {
    return;
  }

  if (!PACER.isAttachmentMenuPage(this.url, document)) {
    return;
  }

  chrome.storage.local.get('options', function (items) {
    if (!items['options']['recap_disabled']) {
      let callback = $.proxy(function (ok) {
        if (ok) {
          history.replaceState({uploaded: true}, '');
          this.notifier.showUpload(
            'Menu page uploaded to the public RECAP Archive.',
            function () {
            }
          );
        }
      }, this);

      this.recap.uploadAttachmentMenu(this.court, this.pacer_case_id,
        document.documentElement.innerHTML, callback);
    } else {
      console.info("RECAP: Not uploading attachment menu. RECAP is disabled.")
    }
  }.bind(this));
};

// If this page offers a single document, ask RECAP whether it has the document.
ContentDelegate.prototype.handleSingleDocumentPageCheck = function() {
  if (!PACER.isSingleDocumentPage(this.url, document)) {
    return;
  }

  let callback = $.proxy(function (api_results) {
    console.info(`RECAP: Got results from API. Running callback on API results to ` +
                 `insert link`);
    let result = api_results.results.filter(function(obj){
      return obj.pacer_doc_id === pacer_doc_id;
    })[0];
    if (!result) {
      return;
    }

    let href = "https://www.courtlistener.com/" + result.filepath_local;
    // Insert a RECAP download link at the bottom of the form.
    $('<div class="recap-banner"/>').append(
      $('<a/>', {
        title: 'Document is available for free in the RECAP Archive.',
        href: href
      }).append(
        $('<img/>', {src: chrome.extension.getURL('assets/images/icon-16.png')})
      ).append(
        ' Get this document for free from the RECAP Archive.'
      )
    ).appendTo($('form'));
  }, this);

  let cl_court = PACER.convertToCourtListenerCourt(this.court);
  this.recap.getAvailabilityForDocuments([this.pacer_doc_id], cl_court, callback);
};

ContentDelegate.prototype.onDocumentViewSubmit = function (event) {
  // Save a copy of the page source, altered so that the "View Document"
  // button goes forward in the history instead of resubmitting the form.
  let originalForm = document.forms[0];
  let originalSubmit = originalForm.getAttribute('onsubmit');
  originalForm.setAttribute('onsubmit', 'history.forward(); return false;');
  let previousPageHtml = document.documentElement.innerHTML;
  originalForm.setAttribute('onsubmit', originalSubmit);

  let form = document.getElementById(event.data.id);

  // Grab the document number, attachment number, and docket number
  let document_number, attachment_number, docket_number;

  if (!PACER.isAppellateCourt(this.court)) {
    // This CSS selector duplicated in isSingleDocumentPage
    let image_string = $('td:contains(Image)').text();
    let regex = /(\d+)-(\d+)/;
    let matches = regex.exec(image_string);
    if (!matches){
      form.submit();
      return;
    }
    document_number = matches[1];
    attachment_number = matches[2];
    docket_number = $.trim($('tr:contains(Case Number) td:nth(1)').text());
  } else { // Appellate
    debug(4,"Appellate parsing not yet implemented");
  }

  // Now do the form request to get to the view page.  Some PACER sites will
  // return an HTML page containing an <iframe> that loads the PDF document;
  // others just return the PDF document.  As we don't know whether we'll get
  // HTML (text) or PDF (binary), we ask for an ArrayBuffer and convert later.
  $('body').css('cursor', 'wait');
  let data = new FormData(form);
  httpRequest(form.action, data, function (type, ab, xhr) {
    console.info('RECAP: Successfully submitted RECAP "View" button form: ' +
		 xhr.statusText);
    var blob = new Blob([new Uint8Array(ab)], {type: type});
    // If we got a PDF, we wrap it in a simple HTML page.  This lets us treat
    // both cases uniformly: either way we have an HTML page with an <iframe>
    // in it, which is handled by showPdfPage.
    if (type === 'application/pdf') {
      // canb and ca9 return PDFs and trigger this code path.
      var html = '<style>body { margin: 0; } iframe { border: none; }' +
                 '</style><iframe src="' + URL.createObjectURL(blob) +
                 '" width="100%" height="100%"></iframe>';
      this.showPdfPage(document.documentElement, html, previousPageHtml,
        document_number, attachment_number, docket_number);
    } else {
      // dcd (and presumably others) trigger this code path.
      var reader = new FileReader();
      reader.onload = function() {
          this.showPdfPage(
            document.documentElement, reader.result, previousPageHtml,
            document_number, attachment_number, docket_number);
      }.bind(this);
      reader.readAsText(blob);  // convert blob to HTML text
    }
  }.bind(this));
};

// Given the HTML for a page with an <iframe> in it, downloads the PDF
// document in the iframe, displays it in the browser, and also
// uploads the PDF document to RECAP.
//
// The documentElement is provided via dependency injection so that it
// can be properly mocked in tests.
ContentDelegate.prototype.showPdfPage = function(
  documentElement, html, previousPageHtml, document_number, attachment_number,
  docket_number) {
  // Find the <iframe> URL in the HTML string.
  let match = html.match(/([^]*?)<iframe[^>]*src="(.*?)"([^]*)/);
  if (!match) {
    documentElement.innerHTML = html;
    return;
  }

  // Show the page with a blank <iframe> while waiting for the download.
  documentElement.innerHTML =
    match[1] +
    '<p>Waiting for download...<p><iframe src="about:blank"' +
    match[3];

  // Download the file from the <iframe> URL.
  httpRequest(match[2], null, function (type, ab, xhr) {
    console.info(
      "RECAP: Successfully got PDF as arraybuffer via ajax request.");

    // Make the Back button redisplay the previous page.
    window.onpopstate = function(event) {
      if (event.state.content) {
        documentElement.innerHTML = event.state.content;
      }
    };
    history.replaceState({content: previousPageHtml}, '');

    // Get the PACER case ID and, on completion, define displayPDF()
    // to either display the PDF in the provided <iframe>, or, if
    // external_pdf is set, save it using FileSaver.js's saveAs().
    let blob = new Blob([new Uint8Array(ab)], {type: type});
    this.recap.getPacerCaseIdFromPacerDocId(
      this.pacer_doc_id, function(pacer_case_id){
        console.info(`RECAP: Stored pacer_case_id is ${pacer_case_id}`);
        let displayPDF = function (items) {
          let filename;
          if (items.options.ia_style_filenames) {
            filename = 'gov.uscourts.' + this.court + '.' +
              (pacer_case_id || 'unknown-case-id') + '.' +
              document_number + '.' + (attachment_number || '0') + '.pdf';
          } else if (items.options.lawyer_style_filenames) {
            filename = PACER.COURT_ABBREVS[this.court] + '_' + docket_number +
              '_' + document_number + '_' + (attachment_number || '0') + '.pdf';
          }

          let external_pdf = items.options.external_pdf;
          if ((navigator.userAgent.indexOf('Chrome') >= 0) &&
              !navigator.plugins.namedItem('Chrome PDF Viewer')) {
            // We are in Google Chrome, and the built-in PDF Viewer has been disabled.
            // So we autodetect and force external_pdf true for proper filenames.
            external_pdf = true;
          }
          if (!external_pdf) {
            let blobUrl = URL.createObjectURL(blob);
            let downloadLink = '<div id="recap-download" class="initial">' +
                '<a href="' + blobUrl + '" download="' + filename + '">' +
                'Save as ' + filename + '</a></div>';
            html = match[1] + downloadLink + '<iframe onload="' +
              'setTimeout(function() {' +
              "  document.getElementById('recap-download').className = '';" +
              '}, 7500)" src="' + blobUrl + '"' + match[3];
            documentElement.innerHTML = html;
            history.pushState({content: html}, '');
          } else {
            // Saving to an external PDF.
            saveAs(blob, filename);
	    documentElement.innerHTML = match[1] +
	      '<p><iframe src="about:blank"'
	      + match[3];  // Clear "Waiting..." message
          }
        }.bind(this);

        chrome.storage.local.get('options', displayPDF);

        let uploadDocument = function(items){
          if (!items['options']['recap_disabled']) {
            // If we have the pacer_case_id, upload the file to RECAP.
            // We can't pass an ArrayBuffer directly to the background
            // page, so we have to convert to a regular array.
            let onUploadOk = function (ok) {
              if (ok) {
                this.notifier.showUpload(
                  'PDF uploaded to the public RECAP Archive.', function () {
                  }.bind(this));
              }
            }.bind(this);

            // In Chrome, blobs can't be passed from content scripts
            // to background scripts, so we have to convert to an
            // array and pass that, then convert back to a blob when
            // we add the data to the FormData object.
            let bytes = arrayBufferToArray(ab);
            this.recap.uploadDocument(
              this.court, pacer_case_id, this.pacer_doc_id, document_number,
              attachment_number, bytes, onUploadOk
            );
          } else {
            console.info("RECAP: Not uploading PDF. RECAP is disabled.");
          }
        }.bind(this);
        chrome.storage.local.get('options', uploadDocument);

      }.bind(this));
  }.bind(this));
};

// If this page offers a single document, intercept navigation to the document
// view page.  The "View Document" button calls the goDLS() function, which
// creates a <form> element and calls submit() on it, so we hook into submit().
ContentDelegate.prototype.handleSingleDocumentPageView = function() {
  if (!PACER.isSingleDocumentPage(this.url, document)) {
    return;
  }

  if (PACER.isAppellateCourt(this.court)) {
    debug(4,"No interposition for appellate downloads yet");
    return;
  }

  // Monkey-patch the <form> prototype so that its submit() method sends a
  // message to this content script instead of submitting the form.  To do this
  // in the page context instead of this script's, we inject a <script> element.
  let script = document.createElement('script');
  script.innerText =
      'document.createElement("form").__proto__.submit = function () {' +
      '  this.id = "form" + new Date().getTime();' +
      '  window.postMessage({id: this.id}, "*");' +
      '};';
  document.body.appendChild(script);

  // When we receive the message from the above submit method, submit the form
  // via XHR so we can get the document before the browser does.
  window.addEventListener(
    'message', this.onDocumentViewSubmit.bind(this), false);
};

// Pop up a dialog offering the link to the free cached copy of the document,
// or just go directly to the free document if popups are turned off.
ContentDelegate.prototype.handleRecapLinkClick = function(window_obj, url) {
  chrome.storage.local.get('options', function (items) {
    if (!items.options.recap_link_popups) {
      window_obj.location = url;
      return;
    }
    $('<div id="recap-shade"/>').appendTo($('body'));
    $('<div class="recap-popup"/>').append(
      $('<a/>', {
        'class': 'recap-close-link',
        href: '#',
        onclick: 'var d = document; d.body.removeChild(this.parentNode); ' +
          'd.body.removeChild(d.getElementById("recap-shade")); return false'
      }).append(
        '\u00d7'
      )
    ).append(
      $('<a/>', {
        href: url,
        onclick: 'var d = document; d.body.removeChild(this.parentNode); ' +
          'd.body.removeChild(d.getElementById("recap-shade"))'
      }).append(
        ' Get this document for free from RECAP.'
      )
    ).append(
      $('<br><br><small>Note that archived documents may be out of date. ' +
        'RECAP is not affiliated with the U.S. Courts. The documents ' +
        'it makes available are voluntarily uploaded by PACER users. ' +
        'RECAP cannot guarantee the authenticity of documents because the ' +
        'courts provide no effective document authentication system.</small>')
    ).appendTo($('body'));
  });
  return false;
};

// Check every link in the document to see if there is a free RECAP document
// available. If there is, put a link with a RECAP icon.
ContentDelegate.prototype.attachRecapLinkToEligibleDocs = function() {
  let linkCount = this.pacer_doc_ids.length;
  console.info(`RECAP: Attaching links to all eligible documents (${linkCount} found)`);
  if (linkCount === 0) {
    return;
  }

  // Ask the server whether any of these documents are available from RECAP.
  this.recap.getAvailabilityForDocuments(this.pacer_doc_ids, this.court,
                                         $.proxy(function (api_results) {
    console.info(`RECAP: Got results from API. Running callback on API results to ` +
                 `attach links and icons where appropriate.`);
    for (let i = 0; i < this.links.length; i++) {
      let pacer_doc_id = $(this.links[i]).data('pacer_doc_id');
      if (!pacer_doc_id) {
        continue;
      }
      let result = api_results.results.filter(function (obj) {
        return obj.pacer_doc_id === pacer_doc_id;
      })[0];
      if (!result){
        continue;
      }
      let href = "https://www.courtlistener.com/" + result.filepath_local;
      let recap_link = $('<a/>', {
        'class': 'recap-inline',
        'title': 'Available for free from the RECAP Archive.',
        'href': href
      });
      recap_link.click($.proxy(this.handleRecapLinkClick, this, window, href));
      recap_link.append($('<img/>').attr({
        src: chrome.extension.getURL('assets/images/icon-16.png')
      }));
      recap_link.insertAfter(this.links[i]);
    }
  }, this));
};
