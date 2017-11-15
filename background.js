// Make services callable from content scripts.
exportInstance(Notifier);
exportInstance(Recap);

function setDefaultOptions(details) {
  // Set options to their default values.
  console.debug("Setting default options after upgrade.");
  chrome.storage.local.get('options', function (items) {
    console.debug("Attempted to get 'options' key from local storage. Got: " +
      items);
    let defaults = {
      recap_link_popups: true,
      show_notifications: true,
      recap_disabled: false,

      // Radio button
      ia_style_filenames: false,
      lawyer_style_filenames: true,
    };
    if ($.isEmptyObject(items)) {
      console.debug("New install. Attempting to set defaults.");
      chrome.storage.local.set({options: defaults});
      console.debug("Set the defaults on new install successfully.");
    } else {
      console.debug("Existing install. Attempting to set new defaults, if any");
      for (let key in defaults) {
        if (!(key in items.options)) {
          items.options[key] = defaults[key];
        }
      }
      console.debug("Persisting new settings object.");
      chrome.storage.local.set({options: items.options});
    }
  });
}
chrome.runtime.onInstalled.addListener(setDefaultOptions);

// Watches all the tabs so we can update their toolbar buttons on navigation.
chrome.tabs.onUpdated.addListener(function (tabId, details, tab) {
  updateToolbarButton(tab);
});
chrome.tabs.onActivated.addListener(function(activeInfo){
  getTabById(activeInfo.tabId, updateToolbarButton);
});
