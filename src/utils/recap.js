export const UPLOAD_TYPES = {
  DOCKET: 1,
  ATTACHMENT_PAGE: 2,
  PDF: 3,
  DOCKET_HISTORY_REPORT: 4,
  APPELLATE_DOCKET: 5,
  APPELLATE_ATTACHMENT_PAGE: 6,
  CLAIMS_REGISTER_PAGE: 9,
  ZIP: 10,
  IQUERY_PAGE: 12,
  APPELLATE_CASE_QUERY_PAGE: 13,
  CASE_QUERY_RESULT_PAGE: 14,
  APPELLATE_CASE_QUERY_RESULT_PAGE: 15,
  ACMS_DOCKET_JSON: 16,
  ACMS_ATTACHMENT_PAGE: 17,
};

// make token available to helper functions
export const N87GC2 = '45c7946dd8400ad62662565cf79da3c081d9b0e5';
export const authHeader = { Authorization: `Token ${N87GC2}` };
export const jsonHeader = { 'Content-Type': 'application/json' };

// from JSON object, return a formData object
export function buildFormData(body) {
  let formData = new FormData();
  Object.keys(body).map((key) => formData.append(key, body[key]));
  body.upload_type &&
    formData.set('upload_type', UPLOAD_TYPES[body.upload_type]);
  return formData;
}

export const sources =
  '1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35,37,' +
  '39,41,43,45,47,49,51,53,55,57,59,61,63,65,67,69,71,73,' +
  '75,77,79,81,83,85,87,89,91,93,95,97,99,101,103,105,107,' +
  '109,111,113,115,117,119,121,123,125,127';
