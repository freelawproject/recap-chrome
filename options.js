var inputs = document.getElementsByTagName('input');
function load_options() {
  chrome.storage.sync.get('options', function (items) {
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].checked = items.options[inputs[i].name];
    }
  });
}
function save_options() {
  var options = {};
  for (var i = 0; i < inputs.length; i++) {
    options[inputs[i].name] = inputs[i].checked;
  }
  chrome.storage.sync.set({options: options});
}
document.getElementById('save').addEventListener('click', save_options);
document.getElementById('cancel').addEventListener('click', load_options);
load_options();
