// Dispatch a message to every URL that's in the manifest to say that RECAP is
// installed.  This allows webpages to take action based on the presence of the
// extension and its version. This is only allowed for a small whitelist of
// domains defined in the manifest.
(function () {
  let currentVersion = chrome.runtime.getManifest().version;
  window.postMessage({
    sender: "recap-extension",
    message_name: "version",
    message: currentVersion
  }, "*");
})();
