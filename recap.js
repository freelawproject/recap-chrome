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
// Abstraction of the RECAP server APIs.  This file is browser-independent.


// Public constants and pure functions (functions with no side effects).
RECAP = {};

// Public impure functions (functions with side effects).
function Recap() {
  var SERVER_ROOT = 'http://dev.recapextension.org/recap';
  var caseMeta = {}; // key: casenum, value: {officialcasenum: o}
  var docMeta = {}; // key: docid; value: {casenum: c, docnum: d, subdocnum: s}

  // Stores the case and document metadata from a RECAP server response.
  var storeMetadata = function (object) {
    for (var casenum in (object || {}).cases || {}) {
      caseMeta[casenum] = object.cases[casenum];
    }
    for (var docid in (object || {}).documents || {}) {
      docMeta[docid] = object.documents[docid];
    }
  };

  return {
    // Asks RECAP whether it has a docket page for the specified case.  If it
    // is available, the callback will be called with a {docket_url: ...,
    // timestamp: ...} object, where the "docket_url" field gives the URL at
    // which the docket page can be downloaded from the Internet Archive, and
    // the "timestamp" field contains a date in yucky mm/dd/yy format.
    getAvailabilityForDocket: function (court, caseNumber, cb) {
      var json = JSON.stringify({court: court, casenum: caseNumber});
      httpRequest(SERVER_ROOT + '/query_cases/',
                  'json=' + encodeURIComponent(json), 'json',
                  function (type, object) { cb(object || null); });
    },

    // Asks RECAP whether it has the specified documents.  "urls" should be an
    // array of PACER document URLs, all from the same court.  The callback
    // will be called with a dictionary mapping each of the URLs that exist in
    // RECAP to a {filename: ..., timestamp: ...} object, where the "filename"
    // field contains not a filename but a URL at which the document can be
    // downloaded from the Internet Archive, and the "timestamp" field contains
    // not a timestamp but a date in yucky mm/dd/yy format.
    getAvailabilityForDocuments: function (urls, cb) {
      // The server API takes just one "court" parameter for all the URLs, so we
      // pick the court based on the first URL and assume the rest are the same.
      var court = PACER.getCourtFromUrl(urls[0]);
      if (court) {
        var json = JSON.stringify({court: court, urls: urls});
        httpRequest(SERVER_ROOT + '/query/',
                    'json=' + encodeURIComponent(json), 'json',
                    function (type, object) { cb(object || {}); });
      } else {
        cb({});
      }
    },

    // Sends metadata about a document to the RECAP server, calling the
    // callback with a boolean success flag.
    uploadMetadata: function (
        court, docid, casenum, de_seq_num, dm_id, docnum, cb) {
      var url = SERVER_ROOT + '/adddocmeta/';
      var formData = new FormData();
      formData.append('court', court);
      formData.append('docid', docid);
      formData.append('casenum', casenum);
      formData.append('de_seq_num', de_seq_num);
      formData.append('dm_id', dm_id);
      formData.append('docnum', docnum);
      formData.append('add_case_info', 'true');
      httpRequest(url, formData, 'json', function (type, object) {
        storeMetadata(object);
        cb(object && object.message.match(/updated/i));
      });
    },

    // Uploads an HTML docket to the RECAP server, calling the callback with
    // a boolean success flag.
    uploadDocket: function (court, casenum, filename, type, html, cb) {
      var url = SERVER_ROOT + '/upload/';
      var formData = new FormData();
      formData.append('court', court);
      formData.append('casenum', casenum);
      formData.append('mimetype', type);
      formData.append('data', new Blob([html], {type: type}), filename);
      httpRequest(url, formData, 'json', function (type, object) {
        storeMetadata(object);
        cb(object && object.message.match(/successfully parsed/i));
      });
    },

    // Uploads a "Document Selection Menu" page to the RECAP server, calling
    // the callback with a boolean success flag.
    uploadAttachmentMenu: function (court, filename, type, html, cb) {
      var url = SERVER_ROOT + '/upload/';
      var formData = new FormData();
      formData.append('court', court);
      formData.append('mimetype', type);
      formData.append('data', new Blob([html], {type: type}), filename);
      httpRequest(url, formData, 'json', function (type, object) {
        storeMetadata(object);
        cb(object && object.message.match(/successfully parsed/i));
      });
    },

    // Uploads a PDF document to the RECAP server, calling the callback with
    // a boolean success flag.
    uploadDocument: function (court, path, filename, type, bytes, cb) {
      var url = SERVER_ROOT + '/upload/';
      var blob = new Blob([new Uint8Array(bytes)]);
      var formData = new FormData();
      formData.append('court', court);
      formData.append('url', path);  // should be a doc1-style path
      formData.append('mimetype', type);
      formData.append('data', blob, filename);
      httpRequest(url, formData, 'json', function (type, object) {
        cb(object && object.message.match(/pdf uploaded/i));
      });
    },

    // Given a docid, calls the callback with the corresponding case ID,
    // lawyer-style case number, within-case document number, and subdocument
    // number, if we saw this information from the server in a past response.
    getDocumentMetadata: function (docid, cb) {
      var meta = docMeta[docid] || {};
      cb(meta.casenum, (caseMeta[meta.casenum] || {}).officialcasenum,
         meta.docnum, meta.subdocnum);
    }
  };
};
