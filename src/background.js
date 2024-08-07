import {
  getTabById,
  saveOptionsAndUpdateToolbar,
  setDefaultOptions,
  updateToolbarButton,
} from './utils/toolbar_button.js';
import {
  chooseVariant,
  injectContentScript,
  showNotificationTab,
} from './utils/background.js';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.message === 'requestTabId') {
    sendResponse({ tabId: sender.tab.id });
  }
  if (msg.message === 'clearBadge') {
    chrome.storage.local.get('options', function (items) {
      items.options['dismiss_news_badge'] = true;
      saveOptionsAndUpdateToolbar(items.options);
    });
  }
  if (msg.message === 'upload') {
    let recap = new Recap();
    let notifier = new Notifier();
    let callback = function (ok) {
      if (ok) {
        notifier.showUpload(
          'Free PDF uploaded to the public RECAP Archive.',
          () => {}
        );
      }
    };
    callback.tab = sender.tab;
    let options = msg.options;
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
chrome.tabs.onActivated.addListener(function (activeInfo) {
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
