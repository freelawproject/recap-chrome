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
import {
  areTransactionReceiptsDisabled,
  getCourtFromUrl,
} from './url_and_cookie_helpers.js';

export function getTabById(tabId, cb) {
  chrome.tabs.get(tabId, cb);
}

export function updateToolbarButton(tab) {
  // Updates the toolbar button for a tab to reflect the tab's login status.
  let setTitleIcon = function (title, icon) {
    chrome.action.setTitle({ title: `RECAP: ${title}` });
    chrome.action.setIcon({ path: icon });
  };

  chrome.storage.local.get('options', function (items) {
    if (!Object.keys(items).length) {
      // Firefox 56 bug. The default settings didn't get created properly when
      // upgrading from the legacy extension. This can be removed when everybody
      // is safely beyond 56 (and the ESR)
      setDefaultOptions({});
    }

    if (
      'dismiss_news_badge' in items['options'] &&
      items['options']['dismiss_news_badge']
    ) {
      chrome.action.setBadgeText({ text: '' });
    } else {
      chrome.action.setBadgeText({ text: '1' });
      chrome.action.setBadgeTextColor({ color: 'white' });
      chrome.action.setBadgeBackgroundColor({ color: 'red' });
    }

    if (tab === null || tab === undefined) {
      // There's code in Firefox that can be called before the defaults are set
      // and before the tab is even established. Catch that, and handle it or
      // else it can crash things.
      setTitleIcon('RECAP is ready', {
        19: 'assets/images/grey-19.png',
        38: 'assets/images/grey-38.png',
      });
      return;
    }

    if (items && items['options'] && !items['options']['recap_enabled']) {
      setTitleIcon('RECAP is temporarily disabled', {
        19: 'assets/images/disabled-19.png',
        38: 'assets/images/disabled-38.png',
      });
    } else {
      // Is it a PACER URL?
      let court = getCourtFromUrl(tab.url);
      if (!court) {
        // Not a PACER URL. Show gray.
        setTitleIcon('Not at a PACER site', {
          19: 'assets/images/grey-19.png',
          38: 'assets/images/grey-38.png',
        });
      } else {
        // It's a valid PACER URL. Therefore either show the nice blue icon or
        // show the blue icon with a warning, if receipts are disabled.
        chrome.cookies.get(
          {
            url: tab.url,
            name: 'PacerPref',
          },
          function (pref_cookie) {
            if (areTransactionReceiptsDisabled(pref_cookie)) {
              // Receipts are disabled. Show the warning.
              setTitleIcon('Receipts are disabled in your PACER settings', {
                19: 'assets/images/warning-19.png',
                38: 'assets/images/warning-38.png',
              });
            } else {
              // At PACER, and things look good!
              setTitleIcon('Logged in to PACER. RECAP is active.', {
                19: 'assets/images/icon-19.png',
                38: 'assets/images/icon-38.png',
              });
            }
          }
        );
      }
    }
  });
}

export function setDefaultOptions(details) {
  // Set options to their default values.
  console.debug('RECAP: Setting default options after install/upgrade.');
  chrome.storage.local.get('options', function (items) {
    console.debug(
      'RECAP: Attempted to get options key from local ' +
        `storage. Got: ${items}`
    );
    let defaults = {
      external_pdf: false,
      recap_enabled: true,
      recap_link_popups: true,
      show_notifications: true,
      dismiss_news_badge: true,

      // Radio button
      ia_style_filenames: false,
      lawyer_style_filenames: true,
    };
    if (!Object.keys(items).length) {
      console.debug('RECAP: New install. Attempting to set defaults.');
      saveOptionsAndUpdateToolbar(defaults);
      console.debug('RECAP: Set the defaults on new install successfully.');
    } else {
      console.debug(
        'RECAP: Existing install. Attempting to set new ' + 'defaults, if any'
      );

      // it's weird that we have a `recap_disabled` option
      // when it should be `recap_enabled`.
      //
      // In order to flip the polarity, we'll read out the
      // `recap_disabled` option (which has previously been set,
      // so everyone should have it)
      let optionToUpgrade = 'recap_disabled';
      // if the option is a Boolean (as it should be)
      if (typeof items.options[optionToUpgrade] === 'boolean') {
        // set the inverse option `recap_enabled` to
        // the inverse of `recap_disabled`
        items.options.recap_enabled = !items.options[optionToUpgrade];
      } else {
        // if for some reason it's _not_ a boolean, let's default to uploading.
        items.options.recap_enabled = true;
      }

      // okay now set the rest of the defaults that are missing.
      for (let key in defaults) {
        if (!(key in items.options)) {
          items.options[key] = defaults[key];
        }
      }
      console.debug('RECAP: Persisting new settings object.');
      saveOptionsAndUpdateToolbar(items.options);
    }
  });
}

export function saveOptionsAndUpdateToolbar(options) {
  chrome.storage.local.set({ options: options }, function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      updateToolbarButton(tabs[0]);
    });
  });
}
