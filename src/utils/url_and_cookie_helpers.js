// Returns true if the receipts are disabled globally
export function areTransactionReceiptsDisabled(cookie) {
  return cookie && cookie.value.match(/receipt=N/);
}

export function getCourtFromUrl(url) {
  // This function is used as a security check to ensure that no components of
  // RECAP are being used outside of PACER/ECF/ACMS. Be sure tests pass
  // appropriately before tweaking these regexes.
  if (!url) {
    return null;
  }

  let match;
  // CM/ECF and PACER
  match = url
    .toLowerCase()
    .match(/^\w+:\/\/(ecf|pacer)\.(\w+)(?:\.audio)?\.uscourts\.gov(?:\/.*)?$/);
  if (match) {
    return match[2];
  }

  // ACMS
  match = url
    .toLowerCase()
    .match(/^\w+:\/\/(\w+)-showdoc\.azurewebsites\.us(?:\/.*)?$/);
  if (match) {
    return match[1];
  }

  return null;
}
