// Abstraction of the RECAP server APIs.
// Public impure functions.  (See utils.js for details on defining services.)
function Recap() {
  var SERVER_ROOT = 'https://www.courtlistener.com/api/rest/v3/';
  var UPLOAD_TYPES = {
    'DOCKET': 1,
    'ATTACHMENT_PAGE': 2,
    'PDF': 3
  };
  var caseMeta = {}; // key: pacer_case_id, value: {officialcasenum: o}
  var docMeta = {}; // key: docid; value: {pacer_case_id: c, docnum: d, subdocnum: s}

  // Stores the case and document metadata from a RECAP server response.
  var storeMetadata = function (object) {
    for (var casenum in (object || {}).cases || {}) {
      caseMeta[casenum] = object.cases[casenum];
    }
    for (var docid in (object || {}).documents || {}) {
      docMeta[docid] = object.documents[docid];
    }
  };

  return {
    // Asks RECAP whether it has a docket page for the specified case.  If it
    // is available, the callback will be called with a
    getAvailabilityForDocket: function (pacer_court, pacer_case_id, cb) {
      console.info(`Getting availability of docket ${pacer_case_id} at ` +
                   `${court}`);
      $.ajax({
          url: SERVER_ROOT + 'dockets/',
          data: {
            pacer_case_id: pacer_case_id,
            court: PACER.convertToCourtListenerCourt(pacer_court),
            fields: 'absolute_url,date_modified'
          },
          success: function (data, xhr, textStatus){
            console.info(`Got successful response from server on docket ` +
                         `query: ${textStatus}`);
            cb(data || null);
          },
          error: function (xhr, textStatus, errorThrown) {
            console.error(`Ajax error getting docket availability. Status: ` +
                          `${textStatus}. Error: ${errorThrown}.`);
          }
      });
    },

    // Asks RECAP whether it has the specified documents.
    getAvailabilityForDocuments: function (pacer_doc_ids, pacer_court, cb) {
      // The server API takes just one "court" parameter for all the URLs, so we
      // pick the court based on the first URL and assume the rest are the same.
      console.info("Made it info the getAvailabilityForDocuments function");

      let cl_court = PACER.convertToCourtListenerCourt(pacer_court);
      if (cl_court) {
        $.ajax({
            url: SERVER_ROOT + 'recap-query/',
            data: {
              pacer_doc_id__in: pacer_doc_ids.join(','),
              docket_entry__docket__court: cl_court
            },
            success: function (data, xhr, textStatus){
              console.info(`Got successful response when looking up document ` +
                           `availability: ${textStatus}`);
              cb(data || null);
            },
            error: function(xhr, textStatus, errorThrown){
              console.error(`Ajax error getting document availability. ` +
                            `Status: ${textStatus}. Error: ${errorThrown}` );
            }
        });
      } else {
        cb({});
      }
    },

    // Sends metadata about a document to the RECAP server, calling the
    // callback with a boolean success flag.
    // uploadMetadata: function (
    //     court, docid, casenum, de_seq_num, dm_id, docnum, cb) {
    //   var formData = new FormData();
    //   formData.append('court', court);
    //   formData.append('docid', docid);
    //   formData.append('pacer_case_id', casenum);
    //   formData.append('de_seq_num', de_seq_num);
    //   formData.append('dm_id', dm_id);
    //   formData.append('docnum', docnum);
    //   formData.append('add_case_info', 'true');
    //   httpRequest(
    //     SERVER_ROOT + '/adddocmeta/',
    //     formData,
    //     'json',
    //     function (type, object) {
    //       storeMetadata(object);
    //       cb(object && object.message.match(/updated/i));
    //     }
    //   );
    // },

    // Uploads an HTML docket to the RECAP server, calling the callback with
    // a boolean success flag.
    uploadDocket: function (pacer_court, casenum, filename, html, cb) {
      var formData = new FormData();
      formData.append('court', PACER.convertToCourtListenerCourt(pacer_court));
      formData.append('pacer_case_id', casenum);
      formData.append('upload_type', UPLOAD_TYPES['DOCKET']);
      formData.append('filepath_local', new Blob([html], {type: 'text/plain'}));
      formData.append('debug', DEBUG);
      $.ajax({
        url: SERVER_ROOT + 'recap/',
        method: 'POST',
        processData: false,
        contentType: false,
        data: formData,
        success: function(data, xhr, textStatus){
          console.info(`Successfully uploaded docket: ${textStatus}`);
          cb(data || null);
        },
        error: function(xhr, textStatus, errorThrown){
          console.error(`Ajax error uploading docket. Status: ${textStatus}.` +
                        `Error: ${errorThrown}`);
        }
      });
      // is available, the callback will be called with a {docket_url: ...,
      // timestamp: ...} object, where the "docket_url" field gives the URL at
      // which the docket page can be downloaded from the Internet Archive, and
      // the "timestamp" field contains a date in yucky mm/dd/yy format.
      //   httpRequest(
      //     SERVER_ROOT + '/query_cases/',
      //     'json=' + encodeURIComponent(json),
      //     'json',
      //     function (type, object) {
      //       cb(object || null);
      //   }
      //   httpRequest(
      //   SERVER_ROOT + '/upload/',
      //   formData,
      //   'json',
      //   function (type, object) {
      //     storeMetadata(object);
      //     cb(object && object.message.match(/successfully parsed/i));
      //   }
      // );
    },

    // Uploads a "Document Selection Menu" page to the RECAP server, calling
    // the callback with a boolean success flag.
    uploadAttachmentMenu: function (court, filename, type, html, cb) {
      var formData = new FormData();
      formData.append('court', court);
      formData.append('mimetype', type);
      formData.append('data', new Blob([html], {type: type}), filename);
      httpRequest(
        SERVER_ROOT + '/upload/',
        formData,
        'json',
        function (type, object) {
          storeMetadata(object);
          cb(object && object.message.match(/successfully parsed/i));
        }
      );
    },

    // Uploads a PDF document to the RECAP server, calling the callback with
    // a boolean success flag.
    uploadDocument: function (court, path, filename, type, bytes, cb) {
      var blob = new Blob([new Uint8Array(bytes)]);
      var formData = new FormData();
      formData.append('court', court);
      formData.append('url', path);  // should be a doc1-style path
      formData.append('mimetype', type);
      formData.append('data', blob, filename);
      httpRequest(
        SERVER_ROOT + '/upload/',
        formData,
        'json',
        function (type, object) {
          cb(object && object.message.match(/pdf uploaded/i));
        }
      );
    },

    // Given a docid, calls the callback with the corresponding case ID,
    // lawyer-style case number, within-case document number, and subdocument
    // number, if we saw this information from the server in a past response.
    getDocumentMetadata: function (docid, cb) {
      var meta = docMeta[docid] || {};
      cb(meta.casenum, (caseMeta[meta.casenum] || {}).officialcasenum,
         meta.docnum, meta.subdocnum);
    },
  };
}
