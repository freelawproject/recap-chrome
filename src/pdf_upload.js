const overwriteFormSubmitMethod = () => {
  // Monkey-patch the <form> prototype so its submit() method sends a message
  // instead of submitting the form.  To do this in the page context instead
  // of this script's, we inject a <script> element.
  let script = document.createElement('script');
  script.innerText =
    'document.createElement("form").__proto__.submit = function () {' +
    '  this.id = "form" + new Date().getTime();' +
    '  window.postMessage({id: this.id}, "*");' +
    '};';

  document.body.appendChild(script);
};

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

const downloadDataFromIframe = async (match, tabId) => {
  // Download the file from the <iframe> URL.
  const browserSpecificFetch =
    navigator.userAgent.indexOf('Safari') + navigator.userAgent.indexOf('Chrome') < 0 ? content.fetch : window.fetch;
  const blob = await browserSpecificFetch(match[2]).then((res) => res.blob());
  const dataUrl = await blobToDataURL(blob);
  // store the blob in chrome storage for the background worker
  await updateTabStorage({ [tabId]: { ['pdf_blob']: dataUrl } });
  console.info('RECAP: Successfully got PDF as arraybuffer via ajax request.');

  return blob;
};

const generateFileName = (options, court, pacer_case_id, docket_number, document_number, attachment_number) => {
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
    pieces = [PACER.COURT_ABBREVS[court], docket_number || '0', document_number || '0', attachment_number || '0'];
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
  if (navigator.userAgent.indexOf('Chrome') >= 0 && !navigator.plugins.namedItem('Chrome PDF Viewer')) {
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
