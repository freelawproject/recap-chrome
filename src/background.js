

// Make services callable from content scripts.
exportInstance(Notifier);
exportInstance(Recap);
exportInstance(Acms);

function chooseVariant(details) {
  const options = ['A-A', 'A-C', 'B-B', 'B-D'];
  const randomIndex = Math.floor(Math.random() * options.length);
  let variant = options[randomIndex];
  chrome.storage.local.set({ variant: variant });
}

function saveOptionsAndUpdateToolbar(options) {
  chrome.storage.local.set({ options: options }, function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      updateToolbarButton(tabs[0]);
    });
  });
}

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
      saveOptionsAndUpdateToolbar(defaults)
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
      saveOptionsAndUpdateToolbar(items.options)
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
  } else if (details.reason === 'update' && currentVersion === '1.2.27'){
    chrome.tabs.create({
      url: 'https://free.law/fundraiser/2021/recap'
    });
  } else if (details.reason === 'update' && currentVersion === '1.2.31'){
    chrome.tabs.create({
      url: 'https://free.law/fundraiser/2022/recap'
    });
  } else if (details.reason === 'update' && currentVersion === '2.4.2'){
    chrome.tabs.create({
      url: 'https://donate.free.law/forms/11'
    });
  }
}

function executeScripts(tabId, injectDetailsArray) {
  // This method uses programmatic injection to load content scripts
  // and waits until the helper finishes injecting a script before
  // loading the succeeding one into the active tab.
  //
  // This helper uses the callback parameter of the executeScript and a
  // recursive approach to define the sequence of operations that
  // guarantees the files are loaded in the same order they are listed
  // in the injectDetailsArray parameter.
  //
  // You can read more on this at this [PR](https://github.com/freelawproject/recap-chrome/pull/340).

  function createCallback(tabId, injectDetails, innerCallback) {
    return function () {
      chrome.tabs.executeScript(tabId, injectDetails, innerCallback);
    };
  }

  var callback = null;

  for (var fileDetails of injectDetailsArray.reverse()) {
    callback = createCallback(tabId, fileDetails, callback);
  }

  if (callback !== null) callback(); // execute outermost function
}

async function injectContentScript(tabId, status, url) {
  if (status == 'complete' && PACER.getCourtFromUrl(url)) {
    chrome.tabs.sendMessage(tabId, { message: 'content_script_status' }, async function (msg) {
      if (chrome.runtime.lastError) {
        console.info(`RECAP: Content scripts are not loaded yet`);
      }
      msg = msg || {};
      if (msg.status != 'loaded') {
        console.info(`RECAP: Injecting content scripts`);
        executeScripts(tabId, [
          { file: "InjectManager.js" },
          { file: "assets/js/jquery.js" },
          { file: "assets/js/FileSaver.js" },
          { file: "assets/js/FileSaver.js" },
          { file: 'assets/js/moment.js'},
          { file: 'assets/js/livestamp.js'},
          { file: 'assets/js/bootstrap.bundle.js'},
          { file: 'action_button.js'},
          { file: 'pdf_upload.js'},
          { file: 'utils.js'},
          { file: 'notifier.js'},
          { file: 'toolbar_button.js'},
          { file: 'pacer.js'},
          { file: 'recap.js'},
          { file: 'content_delegate.js'},
          { file: 'appellate/utils.js'},
          { file: 'appellate/appellate.js'},
          { file: 'appellate/acms_api.js'},
          { file: 'content.js'},
      ])
      }
    });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.message === 'requestTabId') {
    sendResponse({ tabId: sender.tab.id });
  }
  if (msg.message === 'upload'){
    let recap = new Recap();
    let notifier = new Notifier();
    let callback = function(ok){
      if (ok) {
        notifier.showUpload('Free PDF uploaded to the public RECAP Archive.', () => {});
      }
    }
    callback.tab = sender.tab
    let options = msg.options
    recap.uploadDocument(
      options.court,
      options.pacer_case_id,
      options.pacer_doc_id,
      options.document_number,
      options.attachment_number,
      'acmsDocumentGuid' in options ? options.acmsDocumentGuid : null,
      callback
    );
  }
});

chrome.runtime.onInstalled.addListener(setDefaultOptions);
chrome.runtime.onInstalled.addListener(showNotificationTab);
chrome.runtime.onInstalled.addListener(chooseVariant);

// Watches all the tabs so we can update their toolbar buttons on navigation.
chrome.tabs.onUpdated.addListener(async function (tabId, details, tab) {
  updateToolbarButton(tab);
  await injectContentScript(tabId, details.status, tab.url);
});
chrome.tabs.onActivated.addListener(function(activeInfo){
  getTabById(activeInfo.tabId, updateToolbarButton);
});

chrome.runtime.onConnect.addListener(function (port) {
  if (port.name === 'popup') {
    port.onDisconnect.addListener(function () {
      chrome.storage.local.get('options', function (items) {
        items.options['dismiss_news_badge'] = true;
        saveOptionsAndUpdateToolbar(items.options);
      });
    });
  }
});
