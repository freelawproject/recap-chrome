// **Background Fetch Wrapper**
//
// This function acts as a wrapper around the regular `fetch` API but executes
// the request within a Chrome extension's background worker. This allows for
// functionalities that might not be possible in the main browser context, such
// as making network requests when the browser tab is closed.
//
// **Arguments:**
//  - `action` (string): The specific action to be performed by the background
//                          worker (e.g., "getAvailabilityForDocket").
//  - `data` (object): An object containing any additional data required by the
//                     background worker for the specified action.
//
// **Returns:**
//  - A Promise that resolves with the response from the background worker.
function dispatchBackgroundFetch({ action, data }) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { message: 'backgroundFetch', fetch: { action, data } },
      (res) => {
        resolve(res);
      }
    );
  });
}

const recapLinkURL = (filepath) => {
  return `https://www.courtlistener.com/${filepath}`;
};
