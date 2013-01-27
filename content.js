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
// Content script to run when the DOM finishes loading (at "document_end").


// If this is a docket query page, ask RECAP whether it has the docket page.
var url = window.location.href;
var court = recap.getCourtFromUrl(url);
if (recap.isDocketQueryUrl(url)) {
  var caseNumber = recap.getDocketQueryCaseNumber(url);
  callBackgroundPage('getMetadataForCase', court, caseNumber, function (result) {
    if (result) {
      // Make a RECAP download button...
      var recapButton = document.createElement('img');
      recapButton.src = chrome.extension.getURL('recap-32x32.png');
      recapButton.style.marginBottom = '-2px';
      recapButton.style.paddingLeft = '4px';
      recapButton.style.width = '16px';
      recapButton.style.height = '16px';

      // ...link it to the free docket page from RECAP...
      var span = document.createElement('span');
      span.innerText =
          ' Get the docket as of ' + result.timestamp + ' for free from RECAP.';
      var recapLink = document.createElement('a');
      recapLink.href = result.docket_url;
      recapLink.title = 'Docket is available for free from RECAP.';
      recapLink.appendChild(recapButton);
      recapLink.appendChild(span);

      // ...and insert the link just after the reset button.
      var resetButton = document.getElementsByName('reset')[0];
      resetButton.parentNode.parentNode.appendChild(recapLink);
    }
  });
}

// Scan the document for all the links and collect the URLs we care about.
var links = document.body.getElementsByTagName('a');
var urls = [];
for (var i = 0; i < links.length; i++) {
  if (recap.isDocumentUrl(links[i].href)) {
    urls.push(links[i].href);
  }
}
if (urls.length) {
  // Ask the server whether any of these documents are available from RECAP.
  callBackgroundPage('getMetadataForDocuments', urls, function (result) {
    // When we get a reply, update all the links that have documents available.
    for (var i = 0; i < links.length; i++) {
      if (links[i].href in result) {
        // Make a RECAP download button...
        var recapButton = document.createElement('img');
        recapButton.src = chrome.extension.getURL('recap-32x32.png');
        recapButton.style.marginBottom = '-2px';
        recapButton.style.paddingLeft = '4px';
        recapButton.style.width = '16px';
        recapButton.style.height = '16px';

        // ...link it to the free copy of the document from RECAP...
        var recapLink = document.createElement('a');
        recapLink.href = result[links[i].href].filename;
        recapLink.title = 'Available for free from RECAP.';
        recapLink.appendChild(recapButton);

        // ...and insert the button just after the original link.
        links[i].parentNode.insertBefore(recapLink, links[i].nextSibling);
      }
    }
  });
}
