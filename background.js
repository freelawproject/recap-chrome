chrome.storage.local.get('options', function (items) {
  // Set options to their default values.
  // Check each default value. If it's not already in the options, set it to
  // the default.
  let defaults = {
    recap_link_popups: true,
    show_notifications: true,
    recap_disabled: false,

    // Radio button
    ia_style_filenames: false,
    lawyer_style_filenames: true,
  };
  for (let key in defaults) {
    if (!(key in items.options)){
      items.options[key] = defaults[key];
    }
  }
  chrome.storage.local.set({options: items.options});
});

// Make services callable from content scripts.
exportInstance(Notifier);
exportInstance(ToolbarButton);
exportInstance(Recap);

