// -------------------------------------------------------------------------
// Abstraction of content scripts to make them modular and testable.

ContentDelegate = function(url, path, court, casenum, docid, links) {
  this.url = url;
  this.path = path;
  this.court = court;
  this.casenum = casenum;
  this.docid = docid;
  this.links = links || [];

  this.notifier = importInstance(Notifier);
  this.recap = importInstance(Recap);
  this.pacer = importInstance(Pacer);

  this.findDocUrls();
};

ContentDelegate.prototype.findDocUrls = function() {
  this.urls = [];
  for (var i=0; i<this.links.length; i++) {
    if (PACER.isDocumentUrl(this.links[i].href)) {
      this.urls.push(this.links[i].href);
    }
  }
};

// If this is a docket query page, ask RECAP whether it has the docket page.
ContentDelegate.prototype.handleDocketQueryUrl = function() {
  if (!PACER.isDocketQueryUrl(this.url)) {
    return;
  }

  this.recap.getAvailabilityForDocket(
    this.court, this.casenum, function (result) {
    if (!(result && result.docket_url)) {
      return;
    }

    // Insert a RECAP download link at the bottom of the form.
    $('<div class="recap-banner"/>').append(
      $('<a/>', {
        title: 'Docket is available for free from RECAP.',
        href: result.docket_url
      }).append(
        $('<img/>', {src: chrome.extension.getURL('assets/images/icon-16.png')})
      ).append(
        ' Get this docket as of ' + result.timestamp + ' for free from RECAP.'
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

  if (!(PACER.isDocketDisplayUrl(this.url) && this.casenum)) {
    return;
  }

  var callback = $.proxy(function (ok) {
    if (ok) {
      history.replaceState({uploaded: true}, '');
      this.notifier.showUpload(
        'Docket uploaded to the public archive.',
        function(){}
      );
    }
  }, this);


  var filename = PACER.getBaseNameFromUrl(this.url).replace('.pl', '.html');
  this.recap.uploadDocket(this.court, this.casenum, filename, 'text/html',
                          document.documentElement.innerHTML, callback);
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

  var callback = $.proxy(function(ok) {
    if (ok) {
      history.replaceState({uploaded: true}, '');
      this.notifier.showUpload(
        'Menu page uploaded to the public archive.',
        function () {}
      );
    }
  }, this);

  this.recap.uploadAttachmentMenu(this.court, this.path, 'text/html',
                                  document.documentElement.innerHTML, callback);
};

// If this page offers a single document, ask RECAP whether it has the document.
ContentDelegate.prototype.handleSingleDocumentPageCheck = function() {
  if (!PACER.isSingleDocumentPage(this.url, document)) {
    return;
  }

  var callback = $.proxy(function (result) {
    if (!(result && result[this.url])) {
      return;
    }

    // Insert a RECAP download link at the bottom of the form.
    $('<div class="recap-banner"/>').append(
      $('<a/>', {
        title: 'Document is available for free from RECAP.',
        href: result[this.url].filename
      }).append(
        $('<img/>', {src: chrome.extension.getURL('assets/images/icon-16.png')})
      ).append(
        ' Get this document for free from RECAP.'
      )
    ).appendTo($('form'));
  }, this);

  this.recap.getAvailabilityForDocuments([this.url], callback);
};

ContentDelegate.prototype.onDocumentViewSubmit = function (event) {
  // Save a copy of the page source, altered so that the "View Document"
  // button goes forward in the history instead of resubmitting the form.
  var originalSubmit = document.forms[0].getAttribute('onsubmit');
  document.forms[0].setAttribute('onsubmit', 'history.forward(); return false;');
  var previousPageHtml = document.documentElement.innerHTML;
  document.forms[0].setAttribute('onsubmit', originalSubmit);

  // Now do the form request to get to the view page.  Some PACER sites will
  // return an HTML page containing an <iframe> that loads the PDF document;
  // others just return the PDF document.  As we don't know whether we'll get
  // HTML (text) or PDF (binary), we ask for an ArrayBuffer and convert later.
  $('body').css('cursor', 'wait');
  var form = document.getElementById(event.data.id);
  var data = new FormData(form);
  httpRequest(form.action, data, 'arraybuffer', function (type, ab) {
    var blob = new Blob([new Uint8Array(ab)], {type: type});
    // If we got a PDF, we wrap it in a simple HTML page.  This lets us treat
    // both cases uniformly: either way we have an HTML page with an <iframe>
    // in it, which is handled by showPdfPage.
    if (type === 'application/pdf') {
      // canb and ca9 return PDFs and trigger this code path.
      var html = '<style>body { margin: 0; } iframe { border: none; }' +
                  '</style><iframe src="' + URL.createObjectURL(blob) +
                  '" width="100%" height="100%"></iframe>';
      this.showPdfPage(document.documentElement, html, previousPageHtml);
    } else {
      // dcd (and presumably others) trigger this code path.
      var reader = new FileReader();
      reader.onload = function() {
        this.showPdfPage(
          document.documentElement, reader.result, previousPageHtml);
      }.bind(this);
      reader.readAsText(blob);  // convert blob to HTML text
    }
  }.bind(this));
};

// Given the HTML for a page with an <iframe> in it, downloads the PDF document
// in the iframe, displays it in the browser, and also uploads the PDF document
// to RECAP.
// The documentElement is provided via dependency injection so that it can be
// properly mocked in tests.
ContentDelegate.prototype.showPdfPage = function(
  documentElement, html, previousPageHtml) {
  // Find the <iframe> URL in the HTML string.
  var match = html.match(/([^]*?)<iframe[^>]*src="(.*?)"([^]*)/);
  if (!match) {
    documentElement.innerHTML = html;
    return;
  }

  // Show the page with a blank <iframe> while waiting for the download.
  documentElement.innerHTML =
    match[1] + '<iframe src="about:blank"' + match[3];

  // Download the file from the <iframe> URL.
  httpRequest(match[2], null, 'arraybuffer', function (type, ab) {
    // Make the Back button redisplay the previous page.
    window.onpopstate = function(event) {
      if (event.state.content) {
        documentElement.innerHTML = event.state.content;
      }
    };
    history.replaceState({content: previousPageHtml}, '');

    // Display the page with the downloaded file in the <iframe>.
    var blob = new Blob([new Uint8Array(ab)], {type: type});
    var blobUrl = URL.createObjectURL(blob);
    this.recap.getDocumentMetadata(
      this.docid, function (caseid, officialcasenum, docnum, subdocnum) {
      var filename1 = 'gov.uscourts.' + this.court + '.' + caseid +
        '.' + docnum + '.' + (subdocnum || '0') + '.pdf';
      var filename2 = PACER.COURT_ABBREVS[this.court] + '_' +
        (officialcasenum || caseid) +
        '_' + docnum + '_' + (subdocnum || '0') + '.pdf';
      var downloadLink = '<div id="recap-download" class="initial">' +
        '<a href="' + blobUrl + '" download="' + filename1 + '">' +
        'Save as ' + filename1 + '</a>' +
        '<a href="' + blobUrl + '" download="' + filename2 + '">' +
        'Save as ' + filename2 + '</a></div>';
      html = match[1] + downloadLink + '<iframe onload="' +
        'setTimeout(function() {' +
        "  document.getElementById('recap-download').className = '';" +
        '}, 7500)" src="' + blobUrl + '"' + match[3];
      documentElement.innerHTML = html;
      history.pushState({content: html}, '');
    });

    // Upload the file to RECAP.  We can't pass an ArrayBuffer directly
    // to the background page, so we have to convert to a regular array.
    var name = this.path.match(/[^\/]+$/)[0] + '.pdf';
    var bytes = arrayBufferToArray(ab);
    var onUploadOk = function (ok) {
      if (ok) {
        this.notifier.showUpload(
          'PDF uploaded to the public archive.', function () {});
      }
    }.bind(this);
    this.recap.uploadDocument(
      this.court, this.path, name, type, bytes, onUploadOk);
  }.bind(this));
};

// If this page offers a single document, intercept navigation to the document
// view page.  The "View Document" button calls the goDLS() function, which
// creates a <form> element and calls submit() on it, so we hook into submit().
ContentDelegate.prototype.handleSingleDocumentPageView = function() {
  if (!PACER.isSingleDocumentPage(this.url, document)) {
    return;
  }

  // Monkey-patch the <form> prototype so that its submit() method sends a
  // message to this content script instead of submitting the form.  To do this
  // in the page context instead of this script's, we inject a <script> element.
  var script = document.createElement('script');
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

// Add mouseover events to links of the 'show_doc' type, so that we can capture
// the doc's metadata.
ContentDelegate.prototype.addMouseoverToConvertibleLinks = function() {
  var self = this;
  for (var i = 0; i < this.links.length; i++) {
    if (PACER.isConvertibleDocumentUrl(this.links[i].href)) {
      this.links[i].addEventListener('mouseover', function () {
        // The 'this' refers to the link in this handler.
        if (!PACER.isConvertibleDocumentUrl(this.href)) {
          // Need to check again if the URL is still convertible, because it
          // may have already been converted by the host page.
          return;
        }
        self.pacer.convertDocumentUrl(
          this.href,
          function (url, docid, caseid, de_seq_num, dm_id, docnum) {
            self.recap.uploadMetadata(
              this.court, docid, caseid, de_seq_num, dm_id, docnum, null);
          }
        );
      });
    }
  }
};

// Pop up a dialog offering the link to the free cached copy of the document,
// or just go directly to the free document if popups are turned off.
ContentDelegate.prototype.handleRecapLinkClick = function(
  window_obj, url, uploadDate) {
  chrome.storage.sync.get('options', function (items) {
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
        ' Get this document as of ' + uploadDate + ' for free from RECAP.'
      )
    ).append(
      $('<br><br><small>Note that archived documents may be out of date. ' +
        'RECAP is not affiliated with the U.S. Courts. The documents ' +
        'it makes available are voluntarily uploaded by PACER users. ' +
        'RECAP cannot guarantee the authenticity of documents because the ' +
        'courts themselves provide no document authentication system.</small>')
    ).appendTo($('body'));
  });
  return false;
};

// Check every link in the document to see if there is a free RECAP document
// available. If there is, put a link with a RECAP icon.
ContentDelegate.prototype.attachRecapLinkToEligibleDocs = function() {
  if (!this.urls.length) {
    return;
  }

  // Ask the server whether any of these documents are available from RECAP.
  this.recap.getAvailabilityForDocuments(this.urls, $.proxy(function (result) {
    // When we get a reply, update all links that have documents available.
    for (var i = 0; i < this.links.length; i++) {
      $.proxy(function (info) {
        if (!info) {
          // No availability for that link.
          return;
        }
        // Insert a RECAP button just after the original link.
        var recap_link = $('<a/>', {
          'class': 'recap-inline',
          'title': 'Available for free from RECAP.',
          'href': info.filename
        });
        recap_link.click($.proxy(this.handleRecapLinkClick, this,
                                 window, info.filename, info.timestamp));
        recap_link.append($('<img/>').attr({
          src: chrome.extension.getURL('assets/images/icon-16.png')
        }));
        recap_link.insertAfter(this.links[i]);
      }, this)(result[this.links[i].href]);
    }
  }, this));
};
