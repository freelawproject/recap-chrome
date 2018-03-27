// Dispatch a message to every URL that's in the manifest to say that RECAP is
// installed.
let currentVersion = chrome.runtime.getManifest().version;
window.postMessage({
  sender: "recap-extension",
  message: currentVersion
}, "*");
