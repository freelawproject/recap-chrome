// Set options to their default values.
chrome.storage.local.get('options', function (items) {
  if (!items.options) {
    chrome.storage.local.set({options: {
      recap_link_popups: true,
      show_notifications: true,
      recap_disabled: false
    }});
  }
});

// Make services callable from content scripts.
exportInstance(Notifier);
exportInstance(ToolbarButton);
exportInstance(Recap);

