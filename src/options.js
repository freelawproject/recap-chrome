// JavaScript for the options page/popup.


let inputs = document.getElementsByTagName('input');

function load_options() {
  chrome.storage.local.get('options', function (items) {
    for (let i = 0; i < inputs.length; i++) {
      if (inputs[i].type === 'checkbox' ||
          inputs[i].type === 'radio') {
        inputs[i].checked = items.options[inputs[i].id];
      } else if (inputs[i].type === 'text') {
        inputs[i].value = items.options[inputs[i].id] || '';
      }
    }
  });
}

function save_options() {
  let options = {};
  for (let i = 0; i < inputs.length; i++) {
    if (inputs[i].type === 'checkbox' ||
        inputs[i].type === 'radio'){
      options[inputs[i].id] = inputs[i].checked;
    } else if (inputs[i].type === 'text') {
      options[inputs[i].id] = inputs[i].value;
    }
  }
  chrome.storage.local.set({options: options}, function(){
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
      updateToolbarButton(tabs[0]);
    });
  });
}

function updateNamingStyle(args) {
  const exampleEl = document.getElementById('filename_example');
  let example = '';
  if (args.options.ia_style_filenames) {
    example = 'gov.uscourts.cand.201881.46.0.pdf';
  } else if (args.options.lawyer_style_filenames) {
    example = 'N.D.Cal._3-08-cv-03251_46_0.pdf';
  } else {
    console.warn(args.options);
  }
  exampleEl.textContent = example;
}

function handle_storage_changes(changed_args) {
  const change_handler = function(options){
    // add other functions to process options changes here.
    updateNamingStyle(options);
  };

  if (changed_args && changed_args.options) {
    change_handler({options: changed_args.options.newValue});
  } else {
    // if this gets called outside of the listener, pull the options
    // directly instead and invoke the change_handler
    chrome.storage.local.get('options', change_handler);
  }
}

if (navigator.userAgent.indexOf('Chrome') < 0) {
  // Autodetect in Chrome. Otherwise offer an option (Firefox and friends)
  let external_pdf = document.getElementById('external_pdf_label');
  external_pdf.classList.remove('hidden');
}

load_options();
handle_storage_changes();
for (let i = 0; i < inputs.length; i++) {
  inputs[i].addEventListener('change', save_options);
}
chrome.storage.onChanged.addListener(handle_storage_changes);

// Show or hide the receipts warning
chrome.tabs.query({active: true, currentWindow: true}, showHideReceiptsWarning);
function showHideReceiptsWarning (tabs){
  chrome.cookies.get({
    url: tabs[0].url,
    name: 'PacerPref'
  }, function (pref_cookie) {
    if (pref_cookie) {
      let disabled_el = document.getElementById('receipts_disabled');
      if (pref_cookie.value.match(/receipt=N/)) {
        // Receipts are disabled. Show the warning.
        disabled_el.classList.remove('hidden');
      } else {
        disabled_el.className += ' hidden';
      }
    }
  });
}


(function () {
  let ver = document.getElementById('version');
  ver.textContent = `(version ${chrome.runtime.getManifest().version})`;
})();
