chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.message === 'content_script_status') {
    sendResponse({ status: 'loaded' });
  }
});
