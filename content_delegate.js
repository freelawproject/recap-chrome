// -------------------------------------------------------------------------
// Abstraction of content scripts to make them modular and testable.

ContentDelegate = function(url, court, casenum) {
  this.url = url;
  this.court = court;
  this.casenum = casenum;

  this.notifier = importInstance(Notifier);
  this.recap = importInstance(Recap);
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
}

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

  this.recap.uploadAttachmentMenu(
    this.court, window.location.pathname, 'text/html',
    document.documentElement.innerHTML, callback
  );
};


// If this page offers a single document, ask RECAP whether it has the document.
ContentDelegate.prototype.handleSingleDocumentPage = function() {
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
