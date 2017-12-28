// Abstraction of the RECAP server APIs.
// Public impure functions.  (See utils.js for details on defining services.)
function Recap() {
  var DEBUG=false, // When true, don't publish what's sent to the archive.
    SERVER_ROOT = 'https://www.courtlistener.com/api/rest/v3/',
    UPLOAD_TYPES = {
      'DOCKET': 1,
      'ATTACHMENT_PAGE': 2,
      'PDF': 3,
      'DOCKET_HISTORY_REPORT': 4,
      'APPELLATE_DOCKET': 5,
      'APPELLATE_ATTACHMENT_PAGE': 6,
    };

  return {
    //Given a pacer_doc_id, return the pacer_case_id that it is associated with
    getPacerCaseIdFromPacerDocId: function (pacer_doc_id, cb) {
      chrome.storage.local.get(pacer_doc_id, function(items){
        let pacer_case_id = items[pacer_doc_id];
        console.info(`RECAP: Got case number '${pacer_case_id}' for pacer_doc_id: ` +
                     `'${pacer_doc_id}'`);
        cb(pacer_case_id);
      });
    },

    // Asks RECAP whether it has a docket page for the specified case.  If it
    // is available, the callback will be called with a
    getAvailabilityForDocket: function (pacer_court, pacer_case_id, cb) {
      console.info(`RECAP: Getting availability of docket ${pacer_case_id} at ` +
                   `${pacer_court}`);
      $.ajax({
          url: SERVER_ROOT + 'dockets/',
          data: {
            pacer_case_id: pacer_case_id,
            court: PACER.convertToCourtListenerCourt(pacer_court),
            fields: 'absolute_url,date_modified'
          },
          success: function (data, textStatus, xhr){
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
      if (cl_court) {
        $.ajax({
            url: SERVER_ROOT + 'recap-query/',
            data: {
              pacer_doc_id__in: pacer_doc_ids.join(','),
              docket_entry__docket__court: cl_court
            },
            success: function (data, textStatus, xhr){
              console.info(`RECAP: Got successful response when looking up document ` +
                           `availability: ${textStatus}`);
              cb(data || null);
            },
            error: function(xhr, textStatus, errorThrown){
              console.error(`RECAP: Ajax error getting document availability. ` +
                            `Status: ${textStatus}. Error: ${errorThrown}` );
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
      formData.append('filepath_local', new Blob([html], {type: 'text/plain'}));
      formData.append('debug', DEBUG);
      $.ajax({
        url: SERVER_ROOT + 'recap/',
        method: 'POST',
        processData: false,
        contentType: false,
        data: formData,
        success: function(data, textStatus, xhr){
          console.info(`RECAP: Successfully uploaded docket or docket ` +
            `history report: '${textStatus}' with processing queue id of ` +
            `${data['id']}`);
          cb(data || null);
        },
        error: function(xhr, textStatus, errorThrown){
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
      formData.append('filepath_local', new Blob([html], {type: 'text/html'}));
      formData.append('debug', DEBUG);
      $.ajax({
        url: SERVER_ROOT + 'recap/',
        method: 'POST',
        processData: false,
        contentType: false,
        data: formData,
        success: function(data, textStatus, xhr){
          console.info(`RECAP: Successfully uploaded attachment page: '${textStatus}' ` +
                       `with processing queue id of ${data['id']}`);
          cb(data || null);
        },
        error: function(xhr, textStatus, errorThrown){
          console.error(`RECAP: Ajax error uploading docket. Status: ${textStatus}.` +
                        `Error: ${errorThrown}`);
        }
      });
    },

    // Uploads a PDF document to the RECAP server, calling the callback with
    // a boolean success flag.
    uploadDocument: function(pacer_court, pacer_case_id, pacer_doc_id,
                             document_number, attachment_number, bytes, cb) {
      console.info(`RECAP: Attempting PDF upload to RECAP Archive with details: ` +
                   `pacer_court: ${pacer_court}, pacer_case_id: ` +
                   `${pacer_case_id}, pacer_doc_id: ${pacer_doc_id}, ` +
                   `document_number: ${document_number}, ` +
                   `attachment_number: ${attachment_number}.`);
      let formData = new FormData();
      formData.append('court', PACER.convertToCourtListenerCourt(pacer_court));
      pacer_case_id && formData.append('pacer_case_id', pacer_case_id);
      pacer_doc_id && formData.append('pacer_doc_id', pacer_doc_id);
      document_number && formData.append('document_number', document_number);
      if (attachment_number && attachment_number !== '0'){
        formData.append('attachment_number', attachment_number);
      }
      formData.append('filepath_local', new Blob([new Uint8Array(bytes)]));
      formData.append('upload_type', UPLOAD_TYPES['PDF']);
      formData.append('debug', DEBUG);
      $.ajax({
        url: SERVER_ROOT + 'recap/',
        method: 'POST',
        processData: false,
        contentType: false,
        data: formData,
        success: function(data, textStatus, xhr){
          console.info(`RECAP: Successfully uploaded PDF: '${textStatus}' ` +
                       `with processing queue id of ${data['id']}`);
          cb(data || null);
        },
        error: function(xhr, textStatus, errorThrown){
          console.error(`RECAP: Ajax error uploading PDF. Status: ${textStatus}.` +
                        `Error: ${errorThrown}`);
        }
      });
    },
  };
}
