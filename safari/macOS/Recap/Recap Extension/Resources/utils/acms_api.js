
// Asynchronously checks the progress of the PDF link generation using a
// provided URL and authorization token.
// This function fetches data from the specified URL using a GET request with
// an Authorization header containing a Bearer token. It then parses the JSON
// response and throws an error if the request fails (status code is not 200).
// Otherwise, it returns the parsed JSON data.
//
// returns A promise that resolves to the parsed JSON data
// on success, or rejects with an error if the request fails.
async function checkProgress(url, token) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok)
    throw new Error(`Error attempting to fetch with checkProgress: ${data}`);

  return data;
}

// Asynchronously submits data to a server using a POST request.
// This function sends a POST request to the specified URL with an
// authorization token and the provided data.
// The data is expected to be a JavaScript object and will be converted
// to format before sending and The Authorization header includes a Bearer
// token for authentication. The function parses the JSON response and
// throws an error if the request fails (status code is not 200 OK).
// Otherwise, it returns the parsed JSON data.
//
// Returns A promise that resolves to the parsed JSON data on success, or
// rejects with an error if the request fails.
async function postData(url, token, body = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok)
    throw new Error(`Error attempting to fetch with postData: ${data}`);

  return data;
}

// This function simulates a while loop using Promises. It takes three
// arguments:
//  - `input`: The initial value for the loop.
//  - `condition`: A function that evaluates to true as long as the loop
//     should continue.
//  - `action`: A function that returns a Promise and performs the loop's
//     logic for each iteration.
//
// It returns a Promise that resolves with the final `input` value when the
// `condition` function becomes false.
//
// It works by defining a recursive helper function `whilst`. This function
// checks the `condition` on the current `input`.
//  - If `condition` is true, it calls the `action` function with `input`.
//    The result (a Promise) is then chained with another call to `whilst`,
//    effectively continuing the loop.
//  - If `condition` is false, it resolves the returned Promise immediately
//    with the current `input` value, signifying the end of the loop.
const promiseWhile = (input, condition, action) => {
  const whilst = (input) =>
    condition(input) ? action(input).then(whilst) : Promise.resolve(input);
  return whilst(input);
};


// Use the ACMS API to retrieve the file GUID and compute the document URL
export async function getDocumentURL(req, sender, sendResponse) {
  const { apiUrl, token, mergePdfFilesRequest } = req.data;
  const url = `${apiUrl}/MergePDFFiles`;
  const data = await postData(url, token, mergePdfFilesRequest);

  const statusQueryUrl = data && data.statusQueryGetUri;

  // Prepare elements to be used within the promiseWhile loop.
  // Helper function to check if the job is completed based on a
  // given status
  const isCompleted = (status) => /Completed/i.test(status);
  // Helper function to determine if we should continue checking
  const condition = (runtimeStatus) => !isCompleted(runtimeStatus);
  // Initial runtime status (empty string)
  const initialRuntimeStatus = '';
  let output = [];

  // Function to perform a single check on the job progress
  const action = (runtimeStatus) =>
    new Promise((resolve, reject) => {
      checkProgress(statusQueryUrl, token)
        .then((response) => {
          // Extract the new runtime status from the response (if it exists)
          const newRuntimeStatus = response && response.runtimeStatus;

          if (!newRuntimeStatus) reject('No runtime status was returned.');

          // Update the output variable if the job is completed
          if (isCompleted(newRuntimeStatus))
            output = response && response.output;

          resolve(newRuntimeStatus);
        })
        .catch((error) => {
          console.log(error);
        });
    });

  // Use promiseWhile to keep checking the status until the job is completed
  let fileGuid = await promiseWhile(
    initialRuntimeStatus,
    condition,
    action
  ).then((status) => output);
  sendResponse(`${apiUrl}/GetMergedFile?fileGuid=${fileGuid}`);
  return true;
}

