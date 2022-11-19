# Change Log

## Upcoming

The following changes are not yet released, but are code complete:

Features:
 - Add banners to advertise RECAP Email ([#309](https://github.com/freelawproject/recap/issues/309))

Changes:
 - None

Fixes:
 - More robust uploading of attachment pages ([#304](https://github.com/freelawproject/recap/issues/304), [#238](https://github.com/freelawproject/recap/issues/238), [#291](https://github.com/freelawproject/recap/issues/291))
 - Docket reports accessed through the reports menu are now properly uploaded ([#249](https://github.com/freelawproject/recap/issues/249))
 - Failing tests are fixed ([#311](https://github.com/freelawproject/recap/issues/311)).

For Developers:
 - Migrates from Travis CI to Github Actions
 - Adds [Puppeteer](https://pptr.dev/) as a dev dependency to use its Chromium binary to run the tests in [headless](https://developers.google.com/web/updates/2017/04/headless-chrome) mode.
 - Updates the configuration file used by Karma to change the default browser used to run the tests.

## Current & Previous

See releases: https://github.com/freelawproject/recap-chrome/releases/