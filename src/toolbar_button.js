// This file is part of RECAP for Chrome.
// Copyright 2013 Ka-Ping Yee <ping@zesty.ca>
//
// RECAP for Chrome is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version.  RECAP for Chrome is distributed in the hope that it will
// be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General
// Public License for more details.
//
// You should have received a copy of the GNU General Public License along with
// RECAP for Chrome.  If not, see: http://www.gnu.org/licenses/

// -------------------------------------------------------------------------
// Toolbar button for RECAP (or "browser action" in Chrome parlance).


function getTabById(tabId, cb){
  chrome.tabs.get(tabId, cb);
}

function updateToolbarButton(tab) {
  // Updates the toolbar button for a tab to reflect the tab's login status.
  let setTitleIcon = function (title, icon) {
    chrome.browserAction.setTitle({title: `RECAP: ${title}`});
    chrome.browserAction.setIcon({path: icon});
  };

  chrome.storage.local.get('options', function(items){
    if (tab === null || tab === undefined) {
      // There's code in Firefox that can be called before the defaults are set
      // and before the tab is even established. Catch that, and handle it or
      // else it can crash things.
      setTitleIcon('RECAP is ready', {
        '19': 'assets/images/grey-19.png',
        '38': 'assets/images/grey-38.png'
      });
      return;
    }
    if ($.isEmptyObject(items)){
      // Firefox 56 bug. The default settings didn't get created properly when
      // upgrading from the legacy extension. This can be removed when everybody
      // is safely beyond 56 (and the ESR)
      setDefaultOptions({});
    }

    if (items && items['options'] && !items['options']['recap_enabled']){
      setTitleIcon('RECAP is temporarily disabled', {
        '19': 'assets/images/disabled-19.png',
        '38': 'assets/images/disabled-38.png'
      });
    } else {
      // Is it a PACER URL?
      let court = PACER.getCourtFromUrl(tab.url);
      if (!court) {
        // Not a PACER URL. Show gray.
        setTitleIcon('Not at a PACER site', {
          '19': 'assets/images/grey-19.png',
          '38': 'assets/images/grey-38.png'
        });
      } else if (PACER.isAppellateCourt(court)) {
        // Appellate court. Show warning.
        setTitleIcon('Appellate courts are not supported', {
          '19': 'assets/images/warning-19.png',
          '38': 'assets/images/warning-38.png'
        });
      } else {
        // It's a valid PACER URL. Therefore either show the nice blue icon or
        // show the blue icon with a warning, if receipts are disabled.
        chrome.cookies.get({
          url: tab.url,
          name: 'PacerPref'
        }, function (pref_cookie) {
          if (pref_cookie && pref_cookie.value.match(/receipt=N/)) {
            // Receipts are disabled. Show the warning.
            setTitleIcon("Receipts are disabled in your PACER settings",{
              '19': 'assets/images/warning-19.png',
              '38': 'assets/images/warning-38.png'
            });
          } else {
            // At PACER, and things look good!
            setTitleIcon('Logged in to PACER. RECAP is active.', {
              '19': 'assets/images/icon-19.png',
              '38': 'assets/images/icon-38.png'
            });
          }
        });

      }
    }
  });
}
