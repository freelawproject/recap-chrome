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
// Abstraction of the RECAP service.  All browser+UI-independent code goes here.

recap = {
  SERVER_ROOT: 'http://recapextension.org/recap',

  // Returns true if a URL looks like that of a document that could be in RECAP.
  isDocumentUrl: function (url) {
    if (url.match(/\/doc1\/\d+/) || url.match(/\/cgi-bin\/show_doc/)) {
      if (recap.getCourtFromUrl(url)) {
        return true;
      }
    }
  },

  // Returns the court identifier for a given URL, or null if not a PACER site.
  getCourtFromUrl: function (url) {
    var match = (url || '').toLowerCase().match(
        /^\w+:\/\/(ecf|ecf-train|pacer)\.(\w+)\.uscourts\.gov\//);
    return match ? match[2] : null;
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
      jsonRequest(recap.SERVER_ROOT + '/query/',
                  'json=' + encodeURIComponent(json),
		  function (result) { callback(result || {}); });
    } else {
      callback({});
    }
  },

  // Asks RECAP what it knows about the specified case.  If RECAP has a docket
  // page for the case, the callback will be called with a {docket_url: ...,
  // timestamp: ...} object, where the "docket_url" field gives the URL at
  // which the docket page can be downloaded from the Internet Archive, and
  // the "timestamp" field contains a date in yucky mm/dd/yy format.
  getMetadataForCase: function (court, caseNumber, callback) {
    var json = JSON.stringify({court: court, casenum: caseNumber});
    jsonRequest(recap.SERVER_ROOT + '/query_cases/',
                'json=' + encodeURIComponent(json),
                function (result) { callback(result || null); });
  },

  // Returns true if the given URL is a page for querying the list of documents
  // in a docket (i.e. the "Docket Sheet" or "History/Documents" query page).
  isDocketQueryUrl: function (url) {
    var match = (url || '').match(/.*\/([^?]*)/);
    var baseName = match ? match[1] : '';
    return baseName === 'DktRpt.pl' || baseName === 'HistDocQry.pl';
  },

  // Given a URL that satisfies isDocketQueryUrl, returns its PACER case number.
  getDocketQueryCaseNumber: function (url) {
    var match = url.match(/\?(\d+)$/);
    return match ? match[1] : null;
  }
};
