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
  getAndStoreVueData,
  overwriteSubmitMethod,
} from './utils/background.js';
import { handleBackgroundFetch } from './utils/background_fetch.js';
import { handleBackgroundNotification } from './utils/background_notifier.js';
import { getDocumentURL } from './utils/acms_api.js';

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
  if (msg.message === 'backgroundFetch') {
    handleBackgroundFetch(msg, sender, sendResponse);
    return true;
  }
  if (msg.message === 'backgroundNotifier') {
    handleBackgroundNotification(msg, sender, sendResponse);
    return true;
  }
  if (msg.message === 'getVueData') {
    getAndStoreVueData(msg, sender, sendResponse);
    return true;
  }
  if (msg.message === 'overwriteSubmit') {
    overwriteSubmitMethod(msg, sender, sendResponse);
    return true;
  }
  if (msg.message === 'fetchAcmsDocumentUrl'){
    getDocumentURL(msg, sender, sendResponse);
    return true;
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
