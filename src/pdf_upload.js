function overwriteFormSubmitMethod() {
  // Monkey-patch the <form> prototype so its submit() method sends a message
  // instead of submitting the form.
  return new Promise((resolve, reject) =>
    chrome.runtime.sendMessage({ message: 'overwriteSubmit' }, (res) => {
      if (res == null) reject('Response cannot be null');
      resolve(res);
    })
  );
}

const copyPDFDocumentPage = () => {
  // Save a copy of the page, altered so that the "View Document"
  // button goes forward in the history instead of resubmitting the form.
  let originalForm = document.forms[0];
  let originalSubmit = originalForm.getAttribute('onsubmit');
  originalForm.setAttribute('onsubmit', 'history.forward(); return false;');
  let previousPageHtml = document.documentElement.innerHTML;
  originalForm.setAttribute('onsubmit', originalSubmit);

  return previousPageHtml;
};

const downloadDataFromIframe = async(match, tabId) => {
  // Download the file from the <iframe> URL.
  const browserSpecificFetch =
    navigator.userAgent.indexOf('Safari') +
      navigator.userAgent.indexOf('Chrome') <
    0
      ? fetch
      : window.fetch;
  const blob = await browserSpecificFetch(match[2]).then((res) => res.blob());
  const fileType = blob.type;
  // Allow only specific file types (e.g., PDF) to be stored in the tab storage.
  // This ensures data integrity.
  const allowedTypes = ['application/pdf'];
  if (!allowedTypes.includes(fileType)) return;
  const dataUrl = await blobToDataURL(blob);
  // store the blob in chrome storage for the background worker
  await updateTabStorage({ [tabId]: { ['pdf_blob']: dataUrl } });
  console.info('RECAP: Successfully got PDF as arraybuffer via ajax request.');

  return blob;
};

const generateFileName = (
  options,
  court,
  pacer_case_id,
  docket_number,
  document_number,
  attachment_number
) => {
  // Computes a name for the file using the configuration from RECAP options
  let filename, pieces;
  if (options.ia_style_filenames) {
    pieces = [
      'gov',
      'uscourts',
      court,
      pacer_case_id || 'unknown-case-id',
      document_number || '0',
      attachment_number || '0',
    ];
    filename = `${pieces.join('.')}.pdf`;
  } else if (options.lawyer_style_filenames) {
    pieces = [
      PACER.COURT_ABBREVS[court],
      docket_number || '0',
      document_number || '0',
      attachment_number || '0',
    ];
    filename = `${pieces.join('_')}.pdf`;
  }
  return filename;
};

const showWaitingMessage = (match) => {
  // Show the page with a blank <iframe> while waiting for the download.
  document.documentElement.innerHTML = `${match[1]}<p id="recap-waiting">Waiting for download...</p><iframe src="about:blank"${match[3]}`;
};

const displayPDFOrSaveIt = (options, filename, match, blob, blobUrl) => {
  // display the PDF in the provided <iframe>, or, if external_pdf is set,
  // save it using FileSaver.js's saveAs().
  let external_pdf = options.external_pdf;
  if (
    navigator.userAgent.indexOf('Chrome') >= 0 &&
    !navigator.plugins.namedItem('Chrome PDF Viewer')
  ) {
    // We are in Google Chrome, and the built-in PDF Viewer has been disabled.
    // So we autodetect and force external_pdf true for proper filenames.
    external_pdf = true;
  }
  if (!external_pdf) {
    let downloadLink = `<div id="recap-download" class="initial">
                            <a href="${blobUrl}" download="${filename}">Save as ${filename}</a>
                          </div>`;
    html = `${match[1]}${downloadLink}<iframe onload="setTimeout(function() {
                document.getElementById('recap-download').className = '';
              }, 7500)" src="${blobUrl}"${match[3]}`;
    document.documentElement.innerHTML = html;
    history.pushState({ content: html }, '');
  } else {
    // Saving to an external PDF.
    const waitingGraph = document.getElementById('recap-waiting');
    if (waitingGraph) {
      waitingGraph.remove();
    }
    window.saveAs(blob, filename);
  }
};

const handleDocFormResponse = function (
  type,
  ab,
  xhr,
  previousPageHtml,
  dataFromReceipt
) {
  // If we got a PDF, we wrap it in a simple HTML page.  This lets us treat
  // both cases uniformly: either way we have an HTML page with an <iframe>
  // in it, which is handled by showPdfPage.
  if (type === 'application/pdf') {
    // canb and ca9 return PDFs and trigger this code path.
    let html = PACER.makeFullPageIFrame(URL.createObjectURL(ab));
    this.showPdfPage(
      html,
      previousPageHtml,
      dataFromReceipt.doc_number,
      dataFromReceipt.att_number,
      dataFromReceipt.docket_number
    );
  } else {
    const reader = new FileReader();
    reader.onload = function () {
      let html = reader.result;
      // check if we have an HTML page which redirects the user to the PDF
      // this was first display by the Northern District of Georgia
      // https://github.com/freelawproject/recap/issues/277
      const redirectResult = Array.from(
        html.matchAll(/window\.location\s*=\s*["']([^"']+)["'];?/g)
      );
      if (redirectResult.length > 0) {
        const url = redirectResult[0][1];
        html = PACER.makeFullPageIFrame(url);
      }
      this.showPdfPage(
        html,
        previousPageHtml,
        dataFromReceipt.doc_number,
        dataFromReceipt.att_number,
        dataFromReceipt.docket_number
      );
    }.bind(this);
    reader.readAsText(ab); // convert blob to HTML text
  }
};

const handleFreeDocResponse = async function (type, ab, xhr) {
  if (type === 'application/pdf') {
    let dataUrl = await blobToDataURL(ab);
    await updateTabStorage({
      [this.dataset.pacerTabId]: { ['pdf_blob']: dataUrl },
    });
    // get data attributes through the dataset object
    let court = PACER.getCourtFromUrl(window.location.href);
    let options = {
      court: PACER.convertToCourtListenerCourt(court),
      pacer_doc_id: this.dataset.pacerDocId,
      pacer_case_id: this.dataset.pacerCaseId,
      document_number: this.dataset.documentNumber,
      attachment_number: this.dataset.attachmentNumber,
      upload_type: 'PDF',
      document: true,
    };
    await dispatchBackgroundFetch({
      action: 'upload',
      data: options,
    });
    await dispatchBackgroundNotifier({
      action: 'showUpload',
      title: 'Document Successfully Uploaded',
      message: 'Free PDF uploaded to the public RECAP Archive.',
    });
  }

  window.location.href = this.href;
};

const showAndUploadPdf = async function (
  html_elements,
  previousPageHtml,
  document_number,
  attachment_number,
  docket_number,
  pacer_doc_id,
  restricted = false
) {
  // Find the <iframe> URL in the HTML string.
  let match = html_elements.match(/([^]*?)<iframe[^>]*src="(.*?)"([^]*)/);
  if (!match) {
    document.documentElement.innerHTML = html_elements;
    return;
  }
  const options = await getItemsFromStorage('options');

  showWaitingMessage(match);

  // Make the Back button redisplay the previous page.
  window.onpopstate = function (event) {
    if (event.state.content) {
      document.documentElement.innerHTML = event.state.content;
    }
  };
  history.replaceState({ content: previousPageHtml }, '');

  let blob = await downloadDataFromIframe(match, this.tabId);
  if (!blob) return document.documentElement.innerHTML = html_elements;
  let blobUrl = URL.createObjectURL(blob);
  let pacer_case_id;

  if (attachment_number && PACER.isAppellateCourt(this.court)) {
    pacer_case_id = this.pacer_case_id
      ? this.pacer_case_id
      : await APPELLATE.getCaseId(
          this.tabId,
          this.queryParameters,
          pacer_doc_id
        );
  } else {
    pacer_case_id = this.pacer_case_id
      ? this.pacer_case_id
      : await getPacerCaseIdFromPacerDocId(this.tabId, pacer_doc_id);
  }

  let filename = generateFileName(
    options,
    this.court,
    pacer_case_id,
    docket_number,
    document_number,
    attachment_number
  );
  displayPDFOrSaveIt(options, filename, match, blob, blobUrl);

  if (!options['recap_enabled'] || restricted)
    return console.info('RECAP: Not uploading PDF. RECAP is disabled.');

  // If we have the pacer_case_id, upload the file to RECAP.
  // We can't pass an ArrayBuffer directly to the background
  // page, so we have to convert to a regular array.
  body = {
    court: PACER.convertToCourtListenerCourt(this.court),
    pacer_case_id: pacer_case_id,
    pacer_doc_id: pacer_doc_id,
    document_number: document_number,
    upload_type: 'PDF',
    document: true,
  };
  if (attachment_number && attachment_number !== '0')
    body['attachment_number'] = attachment_number;
  if (this.acmsDocumentGuid) body['acms_document_guid'] = this.acmsDocumentGuid;

  const upload = await dispatchBackgroundFetch({
    action: 'upload',
    data: body,
  });
  if (upload.error) return;
  await dispatchBackgroundNotifier({
    action: 'showUpload',
    title: 'Document Successfully Uploaded',
    message: 'PDF uploaded to the public RECAP Archive.',
  });
};
