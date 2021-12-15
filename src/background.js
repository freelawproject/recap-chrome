// Make services callable from content scripts.
exportInstance(Notifier);
exportInstance(Recap);

function setDefaultOptions(details) {
  // Set options to their default values.
  console.debug('RECAP: Setting default options after install/upgrade.');
  chrome.storage.local.get('options', function (items) {
    console.debug('RECAP: Attempted to get \'options\' key from local ' +
      `storage. Got: ${items}`);
    let defaults = {
      external_pdf: false,
      recap_enabled: true,
      recap_link_popups: true,
      show_notifications: true,

      // Radio button
      ia_style_filenames: false,
      lawyer_style_filenames: true,
    };
    if ($.isEmptyObject(items)) {
      console.debug('RECAP: New install. Attempting to set defaults.');
      chrome.storage.local.set({options: defaults});
      console.debug('RECAP: Set the defaults on new install successfully.');
    } else {
      console.debug('RECAP: Existing install. Attempting to set new ' +
        'defaults, if any');

      // it's weird that we have a `recap_disabled` option
      // when it should be `recap_enabled`.
      //
      // In order to flip the polarity, we'll read out the
      // `recap_disabled` option (which has previously been set,
      // so everyone should have it)
      let optionToUpgrade = 'recap_disabled';
      // if the option is a Boolean (as it should be)
      if (typeof(items.options[optionToUpgrade]) === 'boolean') {
        // set the inverse option `recap_enabled` to
        // the inverse of `recap_disabled`
        items.options.recap_enabled = !(items.options[optionToUpgrade]);
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
      chrome.storage.local.set({options: items.options});
    }
  });
}

function showNotificationTab(details){
  // Show some kind of notification tab to the user after install/upgrade.
  console.debug('RECAP: showing install/upgrade notification if ' +
    'version matches');
  let currentVersion = chrome.runtime.getManifest().version;
  if (details.reason === 'update' && currentVersion === '1.2.3'){
    // This version is when we pushed for donations. Show that page.
    chrome.tabs.create({
      url: 'https://free.law/fundraisers/2017/recap/'
    });
  } else if (details.reason === 'update' && currentVersion === '1.2.10'){
    chrome.tabs.create({
      url: 'https://free.law/fundraisers/2018/recap/'
    });
  } else if (details.reason === 'update' && currentVersion === '1.2.15'){
    chrome.tabs.create({
      url: 'https://free.law/fundraisers/2019/recap/'
    });
  }
  else if (details.reason === 'update' && currentVersion === '1.2.27'){
    chrome.tabs.create({
      url: 'https://free.law/fundraiser/2021/recap'
    });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.message === 'requestTabId') {
    sendResponse({ tabId: sender.tab.id });
  }
});

chrome.runtime.onInstalled.addListener(setDefaultOptions);
chrome.runtime.onInstalled.addListener(showNotificationTab);

// Watches all the tabs so we can update their toolbar buttons on navigation.
chrome.tabs.onUpdated.addListener(function (tabId, details, tab) {
  updateToolbarButton(tab);
});
chrome.tabs.onActivated.addListener(function(activeInfo){
  getTabById(activeInfo.tabId, updateToolbarButton);
});
