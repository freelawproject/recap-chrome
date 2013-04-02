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
// Background page script.


// Set options to their default values.
chrome.storage.sync.get('options', function (items) {
  if (!items.options) {
    chrome.storage.sync.set({options: {
      recap_link_popups: true,
      status_notifications: true,
      upload_notifications: true
    }});
  }
});

// Make services callable from content scripts.
exportInstance(Notifier);
exportInstance(ToolbarButton);
exportInstance(Pacer);
exportInstance(Recap);
