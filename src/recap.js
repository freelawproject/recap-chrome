// Abstraction of the RECAP server APIs.
// Public impure functions.  (See utils.js for details on defining services.)
function Recap() {
  const DEBUG = false, // When true, don't publish what's sent to the archive.
    SERVER_ROOT = 'https://www.courtlistener.com/api/rest/v3/',
    UPLOAD_TYPES = {
      'DOCKET': 1,
      'ATTACHMENT_PAGE': 2,
      'PDF': 3,
      'DOCKET_HISTORY_REPORT': 4,
      'APPELLATE_DOCKET': 5,
      'APPELLATE_ATTACHMENT_PAGE': 6,
      'CLAIMS_REGISTER_PAGE': 9,
      'ZIP': 10,
    };
  return {

    //Given a pacer_doc_id, return the pacer_case_id that it is associated with
    getPacerCaseIdFromPacerDocId: async function (pacer_doc_id, cb) {
      const tabId = cb.tab.id;
      const tabStore = await getItemsFromStorage(tabId);
      try {
        const docsToCases = tabStore.docsToCases;
        const pacerCaseId = docsToCases[pacer_doc_id];
        console.info([
          'RECAP: Got case number', pacerCaseId,
          'for pacer_doc_id:', pacer_doc_id].join(' ')
        );
        return cb(pacerCaseId);
      } catch (err) {
        console.log('No stored pacer_case_id found in chrome storage');
        return cb(null);
      };
    },

    // Asks RECAP whether it has a docket page for the specified case.  If it
    // is available, the callback will be called with a
    getAvailabilityForDocket: function (pacer_court, pacer_case_id, cb) {
      if (!pacer_case_id){
        console.error("RECAP: Cannot get availability of docket without pacer_case_id.");
        return;
      }
      console.info(`RECAP: Getting availability of docket ${pacer_case_id} at ` +
        `${pacer_court}`);
      $.ajax({
        url: `${SERVER_ROOT}dockets/`,
        data: {
          pacer_case_id: pacer_case_id,
          // Ensure RECAP is a source so we don't get back IDB-only dockets.
          source__in: '1,3,5,7,9,11,13,15',
          court: PACER.convertToCourtListenerCourt(pacer_court),
          fields: 'absolute_url,date_modified'
        },
        success: function (data, textStatus, xhr) {
          console.info(`RECAP: Got successful response from server on docket ` +
            `query: ${textStatus}`);
          cb(data || null);
        },
        error: function (xhr, textStatus, errorThrown) {
          console.error(`RECAP: Ajax error getting docket availability. Status: ` +
            `${textStatus}. Error: ${errorThrown}.`);
        }
      });
    },

    // Asks RECAP whether it has the specified documents.
    getAvailabilityForDocuments: function (pacer_doc_ids, pacer_court, cb) {
      // The server API takes just one "court" parameter for all the URLs, so we
      // pick the court based on the first URL and assume the rest are the same.
      console.info("RECAP: Made it info the getAvailabilityForDocuments function");

      let cl_court = PACER.convertToCourtListenerCourt(pacer_court);
      let pacer_doc_id_csv = pacer_doc_ids.join(",");
      if (cl_court && pacer_doc_id_csv) {
        $.ajax({
          url: `${SERVER_ROOT}recap-query/`,
          data: {
            pacer_doc_id__in: pacer_doc_id_csv,
            docket_entry__docket__court: cl_court
          },
          success: function (data, textStatus, xhr) {
            console.info(`RECAP: Got successful response when looking up document ` +
              `availability: ${textStatus}`);
            cb(data || null);
          },
          error: function (xhr, textStatus, errorThrown) {
            console.error(`RECAP: Ajax error getting document availability. ` +
              `Status: ${textStatus}. Error: ${errorThrown}`);
          }
        });
      } else {
        cb({});
      }
    },

    // Uploads an HTML docket or docket history report to the RECAP server
    uploadDocket: function (pacer_court, pacer_case_id, html, upload_type, cb) {
      let formData = new FormData();
      formData.append('court', PACER.convertToCourtListenerCourt(pacer_court));
      pacer_case_id && formData.append('pacer_case_id', pacer_case_id);
      formData.append('upload_type', UPLOAD_TYPES[upload_type]);
      formData.append('filepath_local', new Blob([html], { type: 'text/plain' }));
      formData.append('debug', DEBUG);
      $.ajax({
        url: `${SERVER_ROOT}recap/`,
        method: 'POST',
        processData: false,
        contentType: false,
        data: formData,
        success: function (data, textStatus, xhr) {
          console.info(`RECAP: Successfully uploaded docket or docket ` +
            `history report: '${textStatus}' with processing queue id of ` +
            `${data['id']}`);
          cb(data || null);
        },
        error: function (xhr, textStatus, errorThrown) {
          console.error(`RECAP: Ajax error uploading docket. Status: ${textStatus}.` +
            `Error: ${errorThrown}`);
        }
      });
    },

    // Uploads a "Document Selection Menu" page to the RECAP server, calling
    // the callback with a boolean success flag.
    uploadAttachmentMenu: function (pacer_court, pacer_case_id, html, cb) {
      let formData = new FormData();
      formData.append('court', PACER.convertToCourtListenerCourt(pacer_court));
      // pacer_case_id is not currently used by backend, but send anyway if we
      // have it.
      pacer_case_id && formData.append('pacer_case_id', pacer_case_id);
      formData.append('upload_type', UPLOAD_TYPES['ATTACHMENT_PAGE']);
      formData.append('filepath_local', new Blob([html], { type: 'text/html' }));
      formData.append('debug', DEBUG);
      $.ajax({
        url: `${SERVER_ROOT}recap/`,
        method: 'POST',
        processData: false,
        contentType: false,
        data: formData,
        success: function (data, textStatus, xhr) {
          console.info(`RECAP: Successfully uploaded attachment page: '${textStatus}' ` +
            `with processing queue id of ${data['id']}`);
          cb(data || null);
        },
        error: function (xhr, textStatus, errorThrown) {
          console.error(`RECAP: Ajax error uploading docket. Status: ${textStatus}.` +
            `Error: ${errorThrown}`);
        }
      });
    },

    // Asynchronously uploads a PDF document to the RECAP server, calling the callback with
    // a boolean success flag.
    uploadDocument: (
      pacer_court,
      pacer_case_id,
      pacer_doc_id,
      document_number,
      attachment_number,
      cb
    ) => {
      console.info([
        `RECAP: Attempting PDF upload to RECAP Archive with details:`,
        `pacer_court: ${pacer_court}`,
        `pacer_case_id: ${pacer_case_id}`,
        `pacer_doc_id: ${pacer_doc_id}`,
        `document_number: ${document_number},`,
        `attachment_number: ${attachment_number}.`
      ].join(' '));

      // extract the tabId from the enhanced callback
      // wait for chrome.storage.local to load the tabStorage
      getItemsFromStorage(cb.tab.id)
        .then(async (tabStorage) => {
          // create form data
          const blob = await fetch(tabStorage['pdf_blob']).then(res => res.blob());
          let formData = new FormData();
          formData.append('court', PACER.convertToCourtListenerCourt(pacer_court));
          pacer_case_id && formData.append('pacer_case_id', pacer_case_id);
          pacer_doc_id && formData.append('pacer_doc_id', pacer_doc_id);
          document_number && formData.append('document_number', document_number);
          if (attachment_number && attachment_number !== '0') {
            formData.append('attachment_number', attachment_number);
          }
          formData.append('filepath_local', blob);
          formData.append('upload_type', UPLOAD_TYPES['PDF']);
          formData.append('debug', DEBUG);
          return formData;
        })
        .then(data => fetch(`${SERVER_ROOT}recap/`, {
          method: 'POST',
          body: data,
          headers: { 'Authorization': `Token ${N87GC2}` }
        }))
        .then(res => res.json())
        .then(result => {
          console.info(`RECAP: Successfully uploaded PDF: 'Success' ` +
            `with processing queue id of ${result.id}`);
          cb(result || null);
          destroyTabStorage(cb.tab.id);
        })
        .catch(error => console.log(`RECAP: Error uploading PDF: ${error}`));
    },

    // Upload a zip file to the RECAP server, calling the cb with ok flag
    uploadZipFile: (
      pacer_court,
      pacer_case_id,
      cb
    ) => {
      console.info([
        `RECAP: Attempting Zip upload to RECAP Archive with details:`,
        `pacer_court: ${pacer_court}`,
        `pacer_case_id: ${pacer_case_id}`,
      ].join(' '));

      // extract the tabId from the enhanced callback
      // wait for chrome.storage.local to load the tabStorage
      getItemsFromStorage(cb.tab.id)
        .then(async (tabStorage) => {
          const docId = (tabStorage.docId && tabStorage.docId !== 'undefined') ? tabStorage.docId : null;
          const blob = await fetch(tabStorage['zip_blob']).then(res => res.blob());
          // create the formData
          const formData = new FormData();
          formData.append('court', PACER.convertToCourtListenerCourt(pacer_court));
          pacer_case_id && formData.append('pacer_case_id', pacer_case_id);
          docId && formData.append('pacer_doc_id', docId);
          formData.append('upload_type', UPLOAD_TYPES['ZIP']);
          formData.append('debug', DEBUG);
          formData.append('filepath_local', blob);
          return formData;
        })
        .then(data => fetch(`${SERVER_ROOT}recap/`, {
          method: 'POST',
          body: data,
          headers: { 'Authorization': `Token ${N87GC2}` }
        }))
        .then(res => res.json())
        .then(result => {
          console.info(`RECAP: Successfully uploaded Zip: 'Success' ` +
            `with processing queue id of ${result.id}`);
          cb(result);
          destroyTabStorage(cb.tab.id);
        })
        .catch(error => {
          cb(null);
          console.log(`RECAP: Error uploading Zip: ${error}`);
        });
    },

    uploadClaimsRegister: async function (pacerCourt, pacerCaseId, claimsPageHtml, cb) {
      const html = new Blob([claimsPageHtml], { type: 'text/html' });
      const formData = new FormData();
      formData.append('pacer_case_id', pacerCaseId);
      formData.append('court', PACER.convertToCourtListenerCourt(pacerCourt));
      formData.append('upload_type', UPLOAD_TYPES['CLAIMS_REGISTER_PAGE']);
      formData.append('filepath_local', html);
      const fetchOptions = {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Token ${N87GC2}`
        }
      };

      fetch(`${SERVER_ROOT}recap/`, fetchOptions)
        .then(res => res.json())
        .then(result => {
          console.log("RECAP: Claims Page uploaded successfully");
          cb(result || null);
        })
        .catch(error => console.log(`RECAP: The following error occurred: ${error}`));
    }
  };
}
