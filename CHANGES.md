# Change Log

## Upcoming

The following changes are not yet released, but are code complete:

Features:
 - Add an actions button to PACER docket pages ([#308](https://github.com/freelawproject/recap/issues/308), [#282](https://github.com/freelawproject/recap-chrome/pull/282))

Changes:
 - Remove option to "Confirm before opening RECAP documents" ([#216](https://github.com/freelawproject/recap/issues/216))
 - Upload iquery.pl docket summary page ([#251](https://github.com/freelawproject/recap/issues/251))
 

Fixes: 
 - Verify the sender's identity in communication between Window objects ([#236](https://github.com/freelawproject/recap/issues/236))

For developers:
 - Nothing yet


## 1.2.30 (2022-11-18)

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
