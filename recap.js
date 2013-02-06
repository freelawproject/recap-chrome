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
// Abstraction of the RECAP server APIs and the PACER website.  All the code
// in this file should be browser-independent.


recap = {
  SERVER_ROOT: 'http://dev.recapextension.org/recap',

  // Returns true if a URL looks like that of a document that could be in RECAP.
  isDocumentUrl: function (url) {
    if (url.match(/\/doc1\/\d+/) || url.match(/\/cgi-bin\/show_doc/)) {
      if (recap.getCourtFromUrl(url)) {
        return true;
      }
    }
  },

  // Returns true if a URL looks like a show_doc link that needs conversion.
  isShowDocUrl: function (url) {
    if (url.match(/\/cgi-bin\/show_doc/)) {
      if (recap.getCourtFromUrl(url)) {
        return true;
      }
    }
  },

  // Returns true if this is a page for downloading a single document.
  isSingleDocumentPage: function (url, document) {
    var inputs = document.getElementsByTagName('input');
    return url.match(/\/doc1\/\d+/) && inputs.length &&
        inputs[inputs.length - 1].value === 'View Document';
  },

  // Returns the court identifier for a given URL, or null if not a PACER site.
  getCourtFromUrl: function (url) {
    var match = (url || '').toLowerCase().match(
        /^\w+:\/\/(ecf|ecf-train|pacer)\.(\w+)\.uscourts\.gov\//);
    return match ? match[2] : null;
  },

  // If this is a page for viewing a PDF document, return the URL to the PDF
  // document (a one-time download link).
  getPdfIframeFromPage: function (document) {
    var iframes = document.getElementsByTagName('iframe');
    if (iframes.length) {
      if (iframes[0].src.replace(/\?.*/, '').match(/\/show_temp\.pl$/)) {
        return iframes[0];
      }
    }
  },

  // Returns the document ID for a document view page.
  getDocumentIdFromUrl: function (url) {
    return (url || '').match(/\/doc1\/(\d+)$/)[1];
  },

  // Asks RECAP what it knows about the specified documents.  "urls" should be
  // an array of PACER document URLs, all from the same court.  The callback
  // will be called with a dictionary that maps each of the URLs that exist in
  // RECAP to a {filename: ..., timestamp: ...} object, where the "filename"
  // field contains not a filename but a URL at which the document can be
  // downloaded from the Internet Archive, and the "timestamp" field contains
  // not a timestamp but a date in yucky mm/dd/yy format.
  getMetadataForDocuments: function (urls, callback) {
    // The server API takes just one "court" parameter for all the URLs, so we
    // pick the court based on the first URL and assume the rest are the same.
    var court = recap.getCourtFromUrl(urls[0]);
    if (court) {
      var json = JSON.stringify({court: court, urls: urls});
      httpRequest(recap.SERVER_ROOT + '/query/',
                  'json=' + encodeURIComponent(json), 'json',
		  function (type, object) { callback(object || {}); });
    } else {
      callback({});
    }
  },

  // Returns true if the given URL is a page for querying the list of documents
  // in a docket (i.e. the "Docket Sheet" or "History/Documents" query page).
  isDocketQueryPageUrl: function (url) {
    // The part after the "?" is all digits.
    return url.match(/\/(DktRpt|HistDocQry)\.pl\?\d+$/);
  },

  // Given a URL that satisfies isDocketQueryPageUrl, gets its case number.
  getDocketQueryCaseNumber: function (url) {
    var match = url.match(/\?(\d+)$/);
    return match ? match[1] : null;
  },

  // Returns true if the given URL is a docket display page (i.e. the page
  // after submitting the "Docket Sheet" or "History/Documents" query page).
  isDocketPageUrl: function (url) {
    // The part after the "?" has hyphens in it.
    return url.match(/\/(DktRpt|HistDocQry)\.pl\?\w+-[\w-]+$/);
  },

  // Asks RECAP what it knows about the specified case.  If RECAP has a docket
  // page for the case, the callback will be called with a {docket_url: ...,
  // timestamp: ...} object, where the "docket_url" field gives the URL at
  // which the docket page can be downloaded from the Internet Archive, and
  // the "timestamp" field contains a date in yucky mm/dd/yy format.
  getMetadataForCase: function (court, caseNumber, callback) {
    var json = JSON.stringify({court: court, casenum: caseNumber});
    httpRequest(recap.SERVER_ROOT + '/query_cases/',
                'json=' + encodeURIComponent(json), 'json',
                function (type, object) { callback(object || null); });
  },

  uploadDocument: function (court, path, name, type, blob, callback) {
    var formData = new FormData();
    formData.append('court', court);
    formData.append('url', path);
    formData.append('mimetype', type);
    formData.append('data', blob, name);
    httpRequest(recap.SERVER_ROOT + '/upload/', formData, 'text',
                function (type, text) { callback(text || null); });
  },

  uploadDocket: function (court, casenum, name, type, html, callback) {
    var formData = new FormData();
    formData.append('court', court);
    formData.append('casenum', casenum);
    formData.append('mimetype', type);
    formData.append('data', new Blob([html], {type: type}), name);
    httpRequest(recap.SERVER_ROOT + '/upload/', formData, 'text',
                function (type, text) { callback(text || null); });
  },

  postMetadata: function (court, docid, casenum, de_seq_num, dm_id, docnum) {
    var formData = new FormData();
    formData.append('court', court);
    formData.append('docid', docid);
    formData.append('casenum', casenum);
    formData.append('de_seq_num', de_seq_num);
    formData.append('dm_id', dm_id);
    formData.append('docnum', docnum);
    formData.append('add_case_info', 'true');
    httpRequest(recap.SERVER_ROOT + '/adddocmeta/', formData, 'text', null);
  }
};
