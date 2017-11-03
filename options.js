// JavaScript for the options page/popup.


let inputs = document.getElementsByTagName('input');

function load_options() {
  chrome.storage.local.get('options', function (items) {
    for (let i = 0; i < inputs.length; i++) {
      if (inputs[i].type === "checkbox") {
        inputs[i].checked = items.options[inputs[i].id];
      } else if (inputs[i].type === "text") {
        inputs[i].value = items.options[inputs[i].id] || "";
      }
    }
  });
}

function save_options() {
  var options = {};
  for (let i = 0; i < inputs.length; i++) {
    if (inputs[i].type === "checkbox"){
      options[inputs[i].id] = inputs[i].checked;
    } else if (inputs[i].type === "text") {
      options[inputs[i].id] = inputs[i].value;
    }
  }
  chrome.storage.local.set({options: options}, function(){
    if (options['recap_disabled']) {
      chrome.browserAction.setTitle({
        title: 'RECAP is temporarily disabled',
      });
      chrome.browserAction.setIcon({path: {
        '19': 'assets/images/disabled-19.png',
        '38': 'assets/images/disabled-38.png'
      }});
    } else {
      // Just set it to a gray icon, even if at a PACER site.
      chrome.browserAction.setTitle({
        title: 'RECAP is enabled',
      });
      chrome.browserAction.setIcon({
        path: {
          '19': 'assets/images/grey-19.png',
          '38': 'assets/images/grey-38.png'
        }
      });
    }
  });
}

load_options();
for (let i = 0; i < inputs.length; i++) {
  inputs[i].addEventListener('change', save_options);
}

// Set the image source
let img = document.createElement("img");
img.src = chrome.extension.getURL('assets/images/donate-button.png');
let donateLink = document.querySelector("#donate-plea a");
let donateURL = donateLink.href;
donateLink.appendChild(img);
donateLink.addEventListener('click', function(e) {
  e.preventDefault();
  chrome.tabs.create({url: donateURL});
});
