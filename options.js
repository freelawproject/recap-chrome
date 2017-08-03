// JavaScript for the options page/popup.


var inputs = document.getElementsByTagName('input');

function load_options() {
  chrome.storage.local.get('options', function (items) {
    for (var i = 0; i < inputs.length; i++) {
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
  for (var i = 0; i < inputs.length; i++) {
    if (inputs[i].type === "checkbox"){
      options[inputs[i].id] = inputs[i].checked;
    } else if (inputs[i].type === "text") {
      options[inputs[i].id] = inputs[i].value;
    }
  }
  chrome.storage.local.set({options: options});
}

load_options();
for (var i = 0; i < inputs.length; i++) {
  inputs[i].addEventListener('change', save_options);
}

// Set the image source
var img = document.createElement("img");
img.src = chrome.extension.getURL('assets/images/donate-button.png');
var donateLink = document.querySelector("#donate-plea a")
var donateURL = donateLink.href;
donateLink.appendChild(img);
donateLink.addEventListener('click', function(e) {
  e.preventDefault();
  chrome.tabs.create({url: donateURL});
});
