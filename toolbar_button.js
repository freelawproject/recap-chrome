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


// Public impure functions.  (See utils.js for details on defining services.)
function ToolbarButton() {
  var pacerLogin = false;  // true if the user is logged in to PACER
  var notifier = new Notifier();

  // Updates the toolbar button for a tab to reflect the tab's login status.
  var updateToolbarButton = function (tab) {
    var court = PACER.getCourtFromUrl(tab.url);
    var setTitleIcon = function (title, icon) {
      chrome.browserAction.setTitle({title: 'RECAP: ' + title, tabId: tab.id});
      chrome.browserAction.setIcon({path: icon, tabId: tab.id});
    };
    if (!court) {
      setTitleIcon('Not at a PACER site', 'grey-32.png');
    } else if (PACER.isAppellateCourt(court)) {
      setTitleIcon('Appellate courts are not supported', 'warning-32.png');
    } else if (pacerLogin) {
      setTitleIcon('Logged in to PACER', 'icon-32.png');
    } else {
      setTitleIcon('Not logged in to PACER', 'grey-32.png');
    }
  };

  // Watches all the tabs so we can update their toolbar buttons on navigation.
  if (chrome.tabs) {
    chrome.tabs.onUpdated.addListener(function (tabId, details, tab) {
      updateToolbarButton(tab);
    });
  }

  return {
    // Updates our knowledge of the login status based on the current cookies.
    updateCookieStatus: function (court, cookies, cb) {
      if (court) {
        var newPacerLogin = !!PACER.hasPacerCookie(cookies);
        if (newPacerLogin != pacerLogin) {
          notifier.showStatus(newPacerLogin,
            newPacerLogin ? 'Logged in to PACER' : 'Logged out of PACER', null);
          pacerLogin = newPacerLogin;
          chrome.tabs.query({}, function (tabs) {
            for (var i = 0; i < tabs.length; i++) {
              updateToolbarButton(tabs[i]);
            }
          });
        }
      }
    }
  };
}
