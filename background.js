// Set options to their default values.
chrome.storage.local.get('options', function (items) {
  if (!items.options) {
    chrome.storage.local.set({options: {
      recap_link_popups: true,
      status_notifications: true,
      upload_notifications: true
    }});
  }
});

// Make services callable from content scripts.
exportInstance(Notifier);
exportInstance(ToolbarButton);
exportInstance(Recap);

var DEBUG = 'true';
function isTemporary(details) {
  // Set DEBUG = true if it's a development environment.
  DEBUG = details.temporary;
}
chrome.runtime.onInstalled.addListener(isTemporary);
