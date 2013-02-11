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
// Detection of PACER pages and URLs.  This file is browser-independent.


pacer = {
  // Returns the court identifier for a given URL, or null if not a PACER site.
  getCourtFromUrl: function (url) {
    var match = (url || '').toLowerCase().match(
        /^\w+:\/\/(ecf|ecf-train|pacer)\.(\w+)\.uscourts\.gov\//);
    return match ? match[2] : null;
  },

  // Returns true if the given URL looks like a link to a PACER document.
  isDocumentUrl: function (url) {
    if (url.match(/\/doc1\/\d+/) || url.match(/\/cgi-bin\/show_doc/)) {
      if (pacer.getCourtFromUrl(url)) {
        return true;
      }
    }
  },

  // Returns true if a URL looks like a show_doc link that needs conversion.
  isConvertibleDocumentUrl: function (url) {
    if (url.match(/\/cgi-bin\/show_doc/)) {
      if (pacer.getCourtFromUrl(url)) {
        return true;
      }
    }
  },

  // Converts a show_doc-style URL into a doc1-style URL, calling the callback
  // with the arguments (doc1_url, docid, caseid, de_seq_num, dm_id, doc_num).
  convertDocumentUrl: function (url, callback) {
    var query = url.match(/\?.*/)[0];
    var params = {};
    // The parameters only contain digits, so we don't need to unescape.
    query.replace(/([^=?&]+)=([^&]*)/g, function (p, k, v) { params[k] = v; });
    // PACER uses a crazy query string encoding with "K" and "V" as delimiters.
    httpRequest('/cgi-bin/document_link.pl?document' +
                query.replace(/[?&]/g, 'K').replace(/=/g, 'V'),
                null, 'text', function (type, text) {
      callback(text, pacer.getDocumentIdFromUrl(text),
               params.caseid, params.de_seq_num, params.dm_id, params.doc_num);
    });
  },

  // Returns true if this is a page for downloading a single document.
  isSingleDocumentPage: function (url, document) {
    var inputs = document.getElementsByTagName('input');
    return url.match(/\/doc1\/\d+/) && inputs.length &&
        inputs[inputs.length - 1].value === 'View Document';
  },

  // Returns true if this is a "Document Selection Menu" page (a list of the
  // attachments for a particular document).
  isDocumentMenuPage: function (url, document) {
    var inputs = document.getElementsByTagName('input');
    return url.match(/\/doc1\/\d+/) && inputs.length &&
        inputs[inputs.length - 1].value === 'Download All';
  },

  // Returns true if the URL is for the form for querying the list of documents
  // in a docket (i.e. the "Docket Sheet" or "History/Documents" query page).
  isDocketQueryUrl: function (url) {
    // The part after the "?" is all digits.
    return url.match(/\/(DktRpt|HistDocQry)\.pl\?\d+$/);
  },

  // Given a URL that satisfies isDocketQueryUrl, gets its case number.
  getCaseNumberFromUrl: function (url) {
    var match = url.match(/\?(\d+)$/);
    return match ? match[1] : null;
  },

  // Returns true if the given URL is for a docket display page (i.e. the page
  // after submitting the "Docket Sheet" or "History/Documents" query page).
  isDocketDisplayUrl: function (url) {
    // The part after the "?" has hyphens in it.
    return url.match(/\/(DktRpt|HistDocQry)\.pl\?\w+-[\w-]+$/);
  },

  // Gets the last path component of a URL.
  getBaseNameFromUrl: function (url) {
    return url.replace(/\?.*/, '').replace(/.*\//, '');
  },

  // Returns the document ID for a document view page.
  getDocumentIdFromUrl: function (url) {
    return (url || '').match(/\/doc1\/(\d+)$/)[1];
  }
};
