function Acms() {
  async function checkProgress(url, token) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();

    if (!response.ok)
      throw new Error(`Error attempting to fetch with checkProgress: ${data}`);

    return data;
  }

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

  const promiseWhile = (input, condition, action) => {
    const whilst = (input) =>
      condition(input) ? action(input).then(whilst) : Promise.resolve(input);
    return whilst(input);
  };

  return {
    // Use the ACMS API to retrieve the file GUID and compute the document URL
    getDocumentURL: async function (apiUrl, token, mergePdfFilesRequest, cb) {
      const url = `${apiUrl}/MergePDFFiles`;
      const data = await postData(url, token, mergePdfFilesRequest);

      const statusQueryUrl = data && data.statusQueryGetUri;

      const isCompleted = (status) => /Completed/i.test(status);
      const condition = (runtimeStatus) => !isCompleted(runtimeStatus);
      const initialRuntimeStatus = '';

      const action = (runtimeStatus) =>
        new Promise((resolve, reject) => {
          checkProgress(statusQueryUrl, token)
            .then((response) => {
              const newRuntimeStatus = response && response.runtimeStatus;

              if (!newRuntimeStatus) reject('No runtime status was returned.');

              if (isCompleted(newRuntimeStatus))
                output = response && response.output;

              resolve(newRuntimeStatus);
            })
            .catch((error) => {
              console.log(error);
            });
        });

      let fileGuid = await promiseWhile(
        initialRuntimeStatus,
        condition,
        action
      ).then((status) => output);
      cb(`${apiUrl}/GetMergedFile?fileGuid=${fileGuid}`);
    },
  };
}
