// JavaScript for the options page/popup.


let inputs = document.getElementsByTagName('input');

function load_options() {
  chrome.storage.local.get('options', function (items) {
    for (let i = 0; i < inputs.length; i++) {
      if (inputs[i].type === "checkbox" ||
          inputs[i].type === "radio") {
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
    if (inputs[i].type === "checkbox" ||
        inputs[i].type === "radio"){
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
      // Get the current tab, and check if it's a PACER site we're logged into.
      chrome.tabs.query({active: true, currentWindow: true}, getSessionCookie);
      function getSessionCookie (tabs){
        // Get the session cookie (it can be in one of two cookie names).
        chrome.cookies.get({
          url: tabs[0].url,
          name: 'PacerUser'
        }, function(session_cookie){
          if (session_cookie){
            setButtonAndTitle(tabs, session_cookie)
          } else {
            chrome.cookies.get({
              url: tabs[0].url,
              name: 'PacerSession'
            }, setButtonAndTitle.bind(this, tabs));
          }
        });
      }

      // If it's a valid PACER site that we're logged into, show the correct
      // button and message.
      function setButtonAndTitle (tabs, session_cookie) {
        if (session_cookie) {
          // If it's a valid PACER site, then we either show the nice blue icon
          // or we show the blue with a warning, if they have receipts disabled.
          chrome.cookies.get({
            url: tabs[0].url,
            name: 'PacerPref'
          }, function (pref_cookie) {
            if (pref_cookie && pref_cookie.value.match(/receipt=N/)) {
              // Receipts are disabled. Show the warning.
              chrome.browserAction.setTitle({
                title: 'Receipts are disabled in your PACER settings',
              });
              chrome.browserAction.setIcon({
                path: {
                  '19': 'assets/images/warning-19.png',
                  '38': 'assets/images/warning-38.png'
                }
              });
            } else {
              // At PACER, and things look good. Carry on!
              chrome.browserAction.setTitle({
                title: 'Logged into PACER. RECAP is active.',
              });
              chrome.browserAction.setIcon({
                path: {
                  '19': 'assets/images/icon-19.png',
                  '38': 'assets/images/icon-38.png'
                }
              });
            }
          });
        } else {
          // Not PACER, show gray
          chrome.browserAction.setTitle({
            title: 'Not at a PACER site',
          });
          chrome.browserAction.setIcon({
            path: {
              '19': 'assets/images/grey-19.png',
              '38': 'assets/images/grey-38.png'
            }
          });
        }
      }
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
