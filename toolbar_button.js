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
  // A flag for each tab indicating whether the user is logged in to PACER.
  var tabStatus = {};
  var tabListenerAdded = false;

  return {
    // Updates PACER login status of the given tab.
    setPacerLoginStatus: function (loggedIn, cb) {
      // Updates the button's appearance to reflect the tab's login status.
      var updateTab = function (id) {
        var message = (tabStatus[id] ? '' : 'not ') + 'logged in to PACER';
        chrome.browserAction.setTitle({
          title: 'RECAP: ' + message,
          tabId: id
        });
        chrome.browserAction.setIcon({
          path: tabStatus[id] ? 'icon-32.png' : 'grey-32.png',
          tabId: id
        });
      };
      // Chrome resets the toolbar button on navigation, so we have to keep
      // reapplying the button title and icon or it will revert to the default.
      if (!tabListenerAdded) {
        chrome.tabs.onUpdated.addListener(function (tabId, details, tab) {
          updateTab(tabId);
        });
        tabListenerAdded = true;
      }
      // Record the status of the tab, then update the toolbar button.
      tabStatus[cb.tab.id] = loggedIn;
      updateTab(cb.tab.id);
      cb();
    }
  };
}
