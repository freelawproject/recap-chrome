import { getCourtFromUrl } from './url_and_cookie_helpers.js';

export function chooseVariant(details) {
  const options = ['A-A', 'A-C', 'B-B', 'B-D'];
  const randomIndex = Math.floor(Math.random() * options.length);
  let variant = options[randomIndex];
  chrome.storage.local.set({ variant: variant });
}

export function executeScripts(tabId, injectDetailsArray) {
  // This method uses programmatic injection to load content scripts
  // and waits until the helper finishes injecting a script before
  // loading the succeeding one into the active tab.
  //
  // This helper uses the callback parameter of the executeScript and a
  // recursive approach to define the sequence of operations that
  // guarantees the files are loaded in the same order they are listed
  // in the injectDetailsArray parameter.
  //
  // You can read more on this at:
  //  https://github.com/freelawproject/recap-chrome/pull/340
  let reversedList = injectDetailsArray.map(function (e) {
    return e['file'];
  });
  chrome.scripting
    .executeScript({
      target: { tabId: tabId },
      files: reversedList,
    })
    .then(() => console.log('injected script file'));
}

export async function injectContentScript(tabId, status, url) {
  if (status == 'complete' && getCourtFromUrl(url)) {
    chrome.tabs.sendMessage(
      tabId,
      { message: 'content_script_status' },
      async function (msg) {
        if (chrome.runtime.lastError) {
          console.info('RECAP: Content scripts are not loaded yet');
        }
        msg = msg || {};
        if (msg.status != 'loaded') {
          console.info('RECAP: Injecting content scripts');
          executeScripts(tabId, [
            { file: 'InjectManager.js' },
            { file: 'assets/js/jquery.js' },
            { file: 'assets/js/FileSaver.js' },
            { file: 'assets/js/moment.js' },
            { file: 'assets/js/livestamp.js' },
            { file: 'assets/js/bootstrap.bundle.js' },
            { file: 'action_button.js' },
            { file: 'pdf_upload.js' },
            { file: 'utils.js' },
            { file: 'pacer.js' },
            { file: 'content_delegate.js' },
            { file: 'appellate/utils.js' },
            { file: 'appellate/appellate.js' },
            { file: 'appellate/acms_api.js' },
            { file: 'utils/fetch.js' },
            { file: 'utils/notifier.js' },
            { file: 'content.js' },
          ]);
        }
      }
    );
  }
}

export function showNotificationTab(details) {
  // Show some kind of notification tab to the user after install/upgrade.
  console.debug(
    'RECAP: showing install/upgrade notification if ' + 'version matches'
  );
  let currentVersion = chrome.runtime.getManifest().version;
  if (details.reason === 'update' && currentVersion === '1.2.3') {
    // This version is when we pushed for donations. Show that page.
    chrome.tabs.create({
      url: 'https://free.law/fundraisers/2017/recap/',
    });
  } else if (details.reason === 'update' && currentVersion === '1.2.10') {
    chrome.tabs.create({
      url: 'https://free.law/fundraisers/2018/recap/',
    });
  } else if (details.reason === 'update' && currentVersion === '1.2.15') {
    chrome.tabs.create({
      url: 'https://free.law/fundraisers/2019/recap/',
    });
  } else if (details.reason === 'update' && currentVersion === '1.2.27') {
    chrome.tabs.create({
      url: 'https://free.law/fundraiser/2021/recap',
    });
  } else if (details.reason === 'update' && currentVersion === '1.2.31') {
    chrome.tabs.create({
      url: 'https://free.law/fundraiser/2022/recap',
    });
  } else if (details.reason === 'update' && currentVersion === '2.4.2') {
    chrome.tabs.create({
      url: 'https://donate.free.law/forms/11',
    });
  }
}
