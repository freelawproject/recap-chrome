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
// Background page script.


provideFunctions({
  // Asks RECAP whether it has the specified documents available for download.
  // The "urls" argument should be an array of PACER document URLs, all from
  // the same court.  The result will be a dictionary that maps each URL with
  // an existing RECAP document to a {timestamp: ..., filename: ...} object,
  // where the "timestamp" field contains not a timestamp but a date in yucky
  // mm/dd/yy format, and the "filename" field contains not a filename but a
  // URL at which the document can be downloaded from the Internet Archive.
  queryUrls: function (urls, callback) {
    // The server API only lets us specify one court for all the URLs, so we
    // pick the court based on the first URL and assume the rest are the same.
    var match = (urls[0] || '').match(/(\w+)\.uscourts\.gov/);
    if (match) {
      jsonRequest(
          'http://recapextension.org/recap/query/',
          'json=' + JSON.stringify({"court": match[1], "urls": urls}),
          callback
      );
    } else {
      callback(null);
    }
  }
});
