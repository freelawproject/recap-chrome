var inputs = document.getElementsByTagName('input');
function load_options() {
  chrome.storage.sync.get('options', function (items) {
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].checked = items.options[inputs[i].id];
    }
  });
}
function save_options() {
  var options = {};
  for (var i = 0; i < inputs.length; i++) {
    options[inputs[i].id] = inputs[i].checked;
  }
  chrome.storage.sync.set({options: options});
}
load_options();
for (var i = 0; i < inputs.length; i++) {
  inputs[i].addEventListener('change', save_options);
}
