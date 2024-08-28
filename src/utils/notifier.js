// **Wrapper to dispatch Background notifications**
//
// Dispatches a notification request to the background script synchronously.
//
// **Arguments:**
//  - `action` (string): The type of notification action to perform (e.g.,
//                          'show', 'showUpload').
//  - `title` (string): The title of the notification.
//  - `message` (string): The body of the notification.
//
// **Returns:**
//  - A Promise that resolves with the response from the background script or
//  rejects if the response is null.
function dispatchBackgroundNotifier({ action, title, message }) {
  return new Promise((resolve, reject) =>
    chrome.runtime.sendMessage(
      { message: 'backgroundNotifier', notifier: { action, title, message } },
      (res) => {
        if (res == null) reject('Response cannot be null');
        resolve(res);
      }
    )
  );
}
