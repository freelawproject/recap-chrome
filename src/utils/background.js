import { getCourtFromUrl } from './url_and_cookie_helpers.js';

let isSafari =
  /Safari/.test(navigator.userAgent) &&
  !/Chrome|Chromium/.test(navigator.userAgent);
let executionWorld = isSafari ? 'MAIN' : chrome.scripting.ExecutionWorld.MAIN;

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
  } else if (details.reason === 'update' && currentVersion === '2.8.2') {
    chrome.tabs.create({
      url: 'https://free.law/fundraiser/2024/recap',
    });
  }
}

export function getAndStoreVueData(req, sender, sendResponse) {
  const getVueDiv = () => {
    // The following code draws inspiration from the Vue devtool extension
    // to identify and inspect Vue components within a web application.
    // Unlike the devtool extension, which explores the entire DOM, this script
    // focuses on extracting the data of the main Vue component. By tailoring
    // the script to the component's HTML structure, we achieve a quick data
    // retrieval process compared to a full DOM exploration.
    // The extracted data is then stored in session storage for later use.
    let contentWrapper = document.getElementsByClassName('text-center')[0];
    let vueMainDiv = contentWrapper.parentElement;
    let vueDataProperties = vueMainDiv.__vue__._data;
    sessionStorage.setItem('recapVueData', JSON.stringify(vueDataProperties));
    sessionStorage.setItem(
      'recapACMSConfiguration',
      JSON.stringify(window._model)
    );
    return true;
  };
  chrome.scripting
    .executeScript({
      target: { tabId: sender.tab.id },
      func: getVueDiv,
      world: executionWorld,
    })
    .then((injectionResults) => sendResponse(injectionResults));
}

export function overwriteSubmitMethod(req, sender, sendResponse) {
  const _overwriteScript = () => {
    document.createElement('form').__proto__.submit = function () {
      this.id = 'form' + new Date().getTime();
      // Gets a reference to the custom button for users with
      // filing permissions.
      let filerButton = document.getElementsByClassName(
        'recap-bttn-for-filers'
      );
      // Check if there are any buttons found and if the button hasn't been
      // clicked yet (doesn't have the 'clicked' attribute).
      if (filerButton.length && !filerButton[0].hasAttribute('clicked')) {
        // If the button exists but wasn't clicked, set a data attribute on the
        // form to prevent uploading the PDF document.
        this.dataset.stopUpload = true;
      }
      window.postMessage({ id: this.id }, '*');
    };
    return true;
  };

  chrome.scripting
    .executeScript({
      target: { tabId: sender.tab.id },
      func: _overwriteScript,
      world: executionWorld,
    })
    .then((injectionResults) => sendResponse(injectionResults));
}
