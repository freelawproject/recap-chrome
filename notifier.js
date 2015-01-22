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
// Desktop notification service.


// Public impure functions.  (See utils.js for details on defining services.)
function Notifier() {
  var showNotification = function (title, message, cb) {
    var notificationOptions = {
      type: 'basic',
      title: title,
      message: message,
      iconUrl: chrome.extension.getURL('assets/images/icon-32.png'),
      priority: 0
    };
    chrome.notifications.create(
      'recap_notification',
      notificationOptions,
      cb
    );
  };
  return {
    // Shows a desktop notification for a few seconds.
    show: function (title, message, cb) {
      showNotification(
        title,
        message,
        cb
      );
    },
    // Shows an upload message if upload notifications are enabled.
    showUpload: function (message, cb) {
      chrome.storage.sync.get('options', function (items) {
        if (items.options.upload_notifications) {
          showNotification(
            'RECAP upload',
            message,
            cb
          );
        }
      });
    },
    // Shows a login status message if login status notifications are enabled.
    showStatus: function (active, message, cb) {
      chrome.storage.sync.get('options', function (items) {
        if (items.options.status_notifications) {
          showNotification(
            active ? 'RECAP is active' : 'RECAP is inactive',
            message,
            cb
          );
        }
      });
    }
  };
}
