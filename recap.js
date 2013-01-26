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
  // will be called with a dictionary that maps each URL with an existing RECAP
  // document to a {filename: ..., timestamp: ...} object, where the "filename"
  // field contains not a filename but a URL at which the document can be
  // downloaded from the Internet Archive, and the "timestamp" field contains
  // not a timestamp but a date in yucky mm/dd/yy format.
  getMetadataForUrls: function (urls, callback) {
    // The server API only lets us specify one court for all the URLs, so we
    // pick the court based on the first URL and assume the rest are the same.
    var court = recap.getCourtFromUrl(urls[0]);
    if (court) {
      var json = JSON.stringify({"court": court, "urls": urls});
      jsonRequest(recap.SERVER_ROOT + '/query/',
                  'json=' + encodeURIComponent(json),
		  function (result) { callback(result || {}); });
    } else {
      callback({});
    }
  }
};
