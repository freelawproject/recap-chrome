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
exportInstance(Pacer);
exportInstance(Recap);
