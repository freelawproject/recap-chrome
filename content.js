// This file is part of RECAP for Chrome.
// Copyright 2013 Ka-Ping Yee <ping@zesty.ca>
//
// RECAP for Chrome is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version.
// 
// RECAP for Chrome is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
// for more details.
// 
// You should have received a copy of the GNU General Public License along with
// RECAP for Chrome.  If not, see: http://www.gnu.org/licenses/

// -------------------------------------------------------------------------
// Content script to run when DOM finishes loading (run_at: "document_end").


var pacer = importInstance(Pacer);
var recap = importInstance(Recap);
var notifier = importInstance(Notifier);

var url = window.location.href;
var court = PACER.getCourtFromUrl(url);

// If this is a docket query page, ask RECAP whether it has the docket page.
if (PACER.isDocketQueryUrl(url)) {
  recap.getAvailabilityForDocket(
    court, PACER.getCaseNumberFromUrl(url), function (result) {
    if (result && result.docket_url) {
      // Insert a RECAP download link at the bottom of the form.
      $('<div class="recap-banner"/>').append(
        $('<a/>', {
          title: 'Docket is available for free from RECAP.',
          href: result.docket_url
        }).append(
          $('<img/>', {src: chrome.extension.getURL('icon-16.png')})
        ).append(
          ' Get this docket as of ' + result.timestamp + ' for free from RECAP.'
        )
      ).append(
        $('<br><small>Note that archived dockets may be out of date.</small>')
      ).appendTo($('form'));
    }
  });
}

if (!(history.state && history.state.uploaded)) {
  // If this is a docket page, upload it to RECAP.
  if (PACER.isDocketDisplayUrl(url)) {
    var casenum = PACER.getCaseNumberFromUrl(document.referrer);
    if (casenum) {
      var filename = PACER.getBaseNameFromUrl(url).replace('.pl', '.html');
      recap.uploadDocket(court, casenum, filename, 'text/html',
                         document.documentElement.innerHTML, function (ok) {
        if (ok) {
          history.replaceState({uploaded: 1});
          notifier.showNotification(
            'RECAP upload', 'Docket uploaded to the public archive.', null);
        }
      });
    }
  }
  
  // If this is a document's menu of attachments, upload it to RECAP.
  if (PACER.isAttachmentMenuPage(url, document)) {
    recap.uploadAttachmentMenu(
      court, window.location.pathname, 'text/html',
      document.documentElement.innerHTML, function (ok) {
      if (ok) {
        history.replaceState({uploaded: 1});
        notifier.showNotification(
          'RECAP upload', 'Menu page uploaded to the public archive.', null);
      }
    });
  }
}

// If this page offers a single document, ask RECAP whether it has the document.
if (PACER.isSingleDocumentPage(url, document)) {
  recap.getAvailabilityForDocuments([url], function (result) {
    if (result && result[url]) {
      // Insert a RECAP download link at the bottom of the form.
      $('<div class="recap-banner"/>').append(
        $('<a/>', {
          title: 'Document is available for free from RECAP.',
          href: result[url].filename
        }).append(
          $('<img/>', {src: chrome.extension.getURL('icon-16.png')})
        ).append(
          ' Get this document for free from RECAP.'
        )
      ).appendTo($('form'));
    }
  });
}

// If this page offers a single document, intercept navigation to the document
// view page.  The "View Document" button calls the goDLS() function, which
// creates a <form> element and calls submit() on it, so we hook into submit().
if (PACER.isSingleDocumentPage(url, document)) {
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
  window.addEventListener('message', function (event) {
    // Save a copy of the page source, altered so that the "View Document"
    // button goes forward in the history instead of resubmitting the form.
    var originalSubmit = document.forms[0].getAttribute('onsubmit');
    document.forms[0].setAttribute('onsubmit', 'history.forward(); return !1;');
    var previousPageHtml = document.documentElement.innerHTML;
    document.forms[0].setAttribute('onsubmit', originalSubmit);
    var docid = PACER.getDocumentIdFromUrl(window.location.href);
    var path = window.location.pathname;
    
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
      // in it, which is handled by showPdfPage (defined below).
      if (type === 'application/pdf') {
        showPdfPage('<style>body { margin: 0; } iframe { border: none; }' +
                    '</style><iframe src="' + URL.createObjectURL(blob) +
                    '" width="100%" height="100%"></iframe>');
      } else {
        var reader = new FileReader();
        reader.onload = function() { showPdfPage(reader.result); };
        reader.readAsText(blob);  // convert blob to HTML text
      }

      // Given the HTML for a page with an <iframe> in it, downloads the PDF
      // document in the iframe, displays it in the browser, and also uploads
      // the PDF document to RECAP.
      function showPdfPage(html) {
        // Find the <iframe> URL in the HTML string.
        var match = html.match(/([^]*?)<iframe[^>]*src="(.*?)"([^]*)/);
        if (!match) {
          document.documentElement.innerHTML = html;
          return;
        }

        // Show the page with a blank <iframe> while waiting for the download.
        document.documentElement.innerHTML =
          match[1] + '<iframe src="about:blank"' + match[3];

        // Download the file from the <iframe> URL.
        httpRequest(match[2], null, 'arraybuffer', function (type, ab) {
          // Make the Back button redisplay the previous page.
          window.onpopstate = function(event) {
            if (event.state.content) {
              document.documentElement.innerHTML = event.state.content;
            }
          };
          history.replaceState({content: previousPageHtml});

          // Display the page with the downloaded file in the <iframe>.
          var blob = new Blob([new Uint8Array(ab)], {type: type});
          var blobUrl = URL.createObjectURL(blob);
          recap.getDocumentMetadata(
            docid, function (caseid, officialcasenum, docnum, subdocnum) {
            var filename1 = 'gov.uscourts.' + court + '.' + caseid +
              '.' + docnum + '.' + (subdocnum || '0') + '.pdf';
            var filename2 = PACER.COURT_ABBREVS[court] + '_' +
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
            document.documentElement.innerHTML = html;
            history.pushState({content: html});
          });
  
          // Upload the file to RECAP.  We can't pass an ArrayBuffer directly
          // to the background page, so we have to convert to a regular array.
          var name = path.match(/[^\/]+$/)[0] + '.pdf';
          var bytes = arrayBufferToArray(ab);
          recap.uploadDocument(court, path, name, type, bytes, function (ok) {
            if (ok) {
              notifier.showNotification(
                'RECAP upload', 'PDF uploaded to the public archive.', null);
            }
          });
        });
      };
    });
  }, false);
}

// Scan the document for all the links and collect the URLs we care about.
var links = document.body.getElementsByTagName('a');
var urls = [];
for (var i = 0; i < links.length; i++) {
  if (PACER.isDocumentUrl(links[i].href)) {
    urls.push(links[i].href);
  }
  links[i].addEventListener('mouseover', function () {
    if (PACER.isConvertibleDocumentUrl(this.href)) {
      pacer.convertDocumentUrl(
        this.href,
        function (url, docid, caseid, de_seq_num, dm_id, docnum) {
          recap.uploadMetadata(
            court, docid, caseid, de_seq_num, dm_id, docnum, null);
        }
      );
    }
  });
}
if (urls.length) {
  // Ask the server whether any of these documents are available from RECAP.
  recap.getAvailabilityForDocuments(urls, function (result) {
    // When we get a reply, update all the links that have documents available.
    for (var i = 0; i < links.length; i++) {
      if (links[i].href in result) {
        // Insert a RECAP button just after the original link.
        $('<a/>', {
          'class': 'recap-inline',
          title: 'Available for free from RECAP.',
          href: result[links[i].href].filename
        }).append(
          $('<img/>').attr({src: chrome.extension.getURL('icon-16.png')})
        ).insertAfter(links[i]);
      }
    }
  });
}
