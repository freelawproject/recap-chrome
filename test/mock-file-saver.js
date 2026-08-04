// Prevent real browser downloads during Karma runs.
// Individual specs can still replace window.saveAs with a spy/stub.
if (typeof window !== 'undefined') {
  var recapOriginalAnchorClick = window.__recapOriginalAnchorClick || HTMLAnchorElement.prototype.click;

  window.__recapApplyDownloadMocks = function () {
    window.saveAs = function () {
      return undefined;
    };
    HTMLAnchorElement.prototype.click = function () {
      // Suppress programmatic anchor clicks in tests to avoid download prompts.
      return undefined;
    };
  };

  window.__recapOriginalAnchorClick = recapOriginalAnchorClick;
  window.__recapApplyDownloadMocks();
}
