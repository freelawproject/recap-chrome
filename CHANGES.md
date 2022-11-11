# Change Log

## Upcoming

The following changes are not yet released, but are code complete:

Features:
 - None

Changes:
 - None

Fixes:
 - Update the function `InputContainer` to make sure the body of the object called document is clear before each test begins.
 - Add `afterEach` method to one of the test cases to avoid leaving undesired variables in the global scope.

 [Issue #311][311],

[311]: https://github.com/freelawproject/recap/issues/311


## Current & Previous

**2022-11-09**

Fixes:
- More robust uploading of attachment pages ([#304](https://github.com/freelawproject/recap/issues/304), [#238](https://github.com/freelawproject/recap/issues/238), [#291](https://github.com/freelawproject/recap/issues/291))

For Developers:
 - Migrates from Travis CI to Github Actions
 - Adds [Puppeteer](https://pptr.dev/) as a dev dependency to use its Chromium binary to run the tests in [headless](https://developers.google.com/web/updates/2017/04/headless-chrome) mode.
 - Updates the configuration file used by Karma to change the default browser used to run the tests.

See releases: https://github.com/freelawproject/recap-chrome/releases/