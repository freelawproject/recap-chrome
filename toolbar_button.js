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
  return {
    // Updates the button to show whether the user is logged in to PACER.
    setPacerLoginStatus: function (loggedIn, cb) {
      chrome.browserAction.setTitle({
        title: 'RECAP: ' + (loggedIn ? '' : 'not ') + 'logged in to PACER',
        tabId: cb.tab.id
      });
      chrome.browserAction.setIcon({
        path: loggedIn ? 'icon-32.png' : 'grey-32.png',
        tabId: cb.tab.id
      });
      cb();
    }
  };
}
