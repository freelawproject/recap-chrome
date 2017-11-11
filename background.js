// Make services callable from content scripts.
exportInstance(Notifier);
exportInstance(ToolbarButton);
exportInstance(Recap);

function setDefaultOptions(details) {
  // Set options to their default values.
  chrome.storage.local.get('options', function (items) {
    let defaults = {
      recap_link_popups: true,
      show_notifications: true,
      recap_disabled: false,

      // Radio button
      ia_style_filenames: false,
      lawyer_style_filenames: true,
    };
    if (!items.options) {
      // Brand new install. Use the defaults.
      items.options = defaults;
    } else {
      // Existing install. Set any new defaults.
      for (let key in defaults) {
        if (!(key in items.options)) {
          items.options[key] = defaults[key];
        }
      }
    }
    chrome.storage.local.set({options: items.options});
  });
}
chrome.runtime.onInstalled.addListener(setDefaultOptions);
