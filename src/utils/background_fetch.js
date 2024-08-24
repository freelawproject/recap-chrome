import { buildFormData, sources, authHeader, jsonHeader } from './recap.js';

// Builds a CourtListener API URL
//
// This function constructs a complete URL for the CourtListener API endpoint
// based on the provided suffix.
//
// **Arguments:**
//  - `suffix` (string): The specific endpoint suffix for the API call.
//
// **Returns:**
//  - A string representing the complete CourtListener API URL.
const courtListenerURL = (suffix) =>
  'https://www.courtlistener.com/api/rest/v3/' + suffix + '/';

// Encodes Search Parameters for GET Requests
//
// This function takes a base URL and an object containing search parameters
// and returns a URL string with the encoded parameters appended.
//
// **Arguments:**
//  - `base` (string): The base URL for the API endpoint.
//  - `params` (object): An object containing key-value pairs for search
//    parameters.
//
// **Returns:**
//  - A string representing the complete URL with encoded search parameters.
const searchParamsURL = ({ base, params }) => {
  const url = new URL(base);
  Object.keys(params).forEach((key) =>
    url.searchParams.append(key, params[key])
  );
  return url.toString();
};

function triggerFetchRequest(url, options, sender, sendResponse) {
  // Callback for Dispatching Background Fetch
  // This internal function handles setting headers, logging information,
  // dispatching the fetch request, and sending the response back
  const dispatchCallback = (_url, _options) => {
    console.debug(_url, _options);
    _options['headers'] = { ...authHeader };
    if (_options.method == 'GET') {
      _options['headers'] = { ..._options['headers'], ...jsonHeader };
    }
    console.info(`RECAP: Dispatching ${_options.method} for ${_url}`);
    // dispatch fetch and return the response
    fetch(_url, _options)
      .then((res) => res.json())
      .then((json) => sendResponse(json))
      .catch((err) => sendResponse({ error: err.message }));
  };
  // Check for existing body data and handle accordingly
  if (!options.body) {
    dispatchCallback(url, options);
    return true;
  }

  // Handle body with HTML content
  if (options.body.html) {
    let blob = new Blob([options.body.html], { type: 'text/plain' });
    options.body['filepath_local'] = blob;
    delete options.body.html;
  }

  // Handle body without document
  if (!options.body.document) {
    const body = buildFormData({ ...options.body });
    dispatchCallback(url, { ...options, body });
    return true;
  }

  // This section handles scenarios where the request body contains a document
  // that needs to be retrieved from the Chrome extension's local storage
  // associated with the sender's tab ID.
  chrome.storage.local.get(sender.tab.id.toString(), async (store) => {
    // get the dataUrl for the file in storage
    let storeKey = sender.tab.id.toString();
    let file = store[storeKey]['pdf_blob'] || store[storeKey]['zip_blob'];
    const blob = await fetch(file).then(
      (res) => res.blob()
    );
    const body = buildFormData({ ...options.body, filepath_local: blob });
    dispatchCallback(url, { ...options, body });
  });
  // return true to allow for the async function to complete
  return true;
}

// This function dispatches fetch requests based on the received action and
// data. It constructs the appropriate URL and options for each action, and
// then triggers the fetch request using the `triggerFetchRequest` function.
export const handleBackgroundFetch = (req, sender, sendResponse) => {
  const { action, data } = req.fetch;
  let url, options;
  switch (action) {
    case 'getAvailabilityForDocket':
      url = searchParamsURL({
        base: courtListenerURL('dockets'),
        params: {
          ...data,
          source__in: sources,
          fields: 'absolute_url,date_modified,date_last_filing',
        },
      });
      options = { method: 'GET' };
      break;
    case 'getAvailabilityForDocuments':
      url = searchParamsURL({
        base: courtListenerURL('recap-query'),
        params: { ...data },
      });
      options = { method: 'GET' };
      break;
    case 'upload':
      url = courtListenerURL('recap');
      options = {
        method: 'POST',
        body: { ...data, debug: false },
      };
      break;
    default:
      return;
  }
  triggerFetchRequest(url, options, sender, sendResponse);
};
