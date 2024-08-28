# Change Log

## Upcoming

The following changes are not yet released, but are code complete:

Features:
 - None yet

Changes:
 - None yet
 
Fixes:
 - None yet

For developers:
 - Nothing yet

## 2.8.0 (2024-08-27)

Features:
 - Upgrade to manifest v3([333](https://github.com/freelawproject/recap/issues/333), [387](https://github.com/freelawproject/recap-chrome/pull/387))

For developers:
 - Adds script to automate release package creation ([388](https://github.com/freelawproject/recap-chrome/pull/388))


## 2.7.2 (2024-07-21)

 Fixes:
 - Refines content_scripts permissions on azure websites([#374](https://github.com/freelawproject/recap/issues/374), [#385](https://github.com/freelawproject/recap-chrome/pull/385))


## 2.7.1 (2024-07-21)

- Rolled back from Version 2.7.0 to Version 2.6.1 


## 2.7.0 (2024-07-19)

Features:
 - Introduces a new upload type for Dockets from ACMS and enhances code maintainability by refactoring common upload logic into reusable functions.([#368](https://github.com/freelawproject/recap-chrome/pull/371))
 - Docket reports from ACMS are now uploaded to CourtListener.([#372](https://github.com/freelawproject/recap-chrome/pull/372))
 - Adds logic to upload ACMS PDF documents to CourtListener. ([#373](https://github.com/freelawproject/recap-chrome/pull/373))
 - Inserts the RECAP button and [R] icons to the ACMS Docket report. ([#374](https://github.com/freelawproject/recap-chrome/pull/374))
 - Displays the warning about combined PDFs on the download page.([#376](https://github.com/freelawproject/recap-chrome/pull/376))
 - Introduces logic to upload ACMS attachment pages to CourtListener([#375](https://github.com/freelawproject/recap-chrome/pull/375))
 - Introduces validation for the cookie used to identify filing account users.([#371](https://github.com/freelawproject/recap/issues/371), [#377](https://github.com/freelawproject/recap-chrome/pull/377)).

Changes:
 - Updates style and replace old logos with new ones([#378](https://github.com/freelawproject/recap-chrome/pull/378))
 - Adds a badge to the extension icon and a banner in the options menu([#379](https://github.com/freelawproject/recap-chrome/pull/379), [#380](https://github.com/freelawproject/recap-chrome/pull/380))
 - Removes the warning icon on ACMS websites([#382](https://github.com/freelawproject/recap-chrome/pull/382))

Fixes:
 - Enhance isLoginPage to accurately identify login pages([#373](https://github.com/freelawproject/recap/issues/373), [#381](https://github.com/freelawproject/recap-chrome/pull/381)).


## 2.6.1 (2024-04-18)

Changes:
 - Adds a banner to the PACER login page to link users to a donate page with information about the pacer class action([#367](https://github.com/freelawproject/recap/issues/367), [#368](https://github.com/freelawproject/recap-chrome/pull/368)).


## 2.6.0 (2024-04-04)

Changes:
 - Adds a badge to the extension icon and a banner in the popup to link users to a donate page with information about the pacer class action([#367](https://github.com/freelawproject/recap/issues/367), [#364](https://github.com/freelawproject/recap-chrome/pull/364)).
 - Adds logic to display variants of the new banner component([#365](https://github.com/freelawproject/recap-chrome/pull/365))
 - Fix setBadgeText type error([#366](https://github.com/freelawproject/recap-chrome/pull/366)).


## 2.5.0 (2024-01-26)

Features:
 - Hide recap UI elements from printed pages([#360](https://github.com/freelawproject/recap/issues/360), [#355](https://github.com/freelawproject/recap-chrome/pull/355)).
 - Provide two clearly labeled buttons on the RECAP receipt page for accounts with filing permissions: one to RECAP the document and the other to download it normally([#360](https://github.com/freelawproject/recap/issues/357), [#355](https://github.com/freelawproject/recap-chrome/pull/357)).

Changes:
 - The RECAP [Privacy Policy](https://free.law/recap/privacy-policy/) is updated, simplified, and clarified. The RECAP [homepage](https://free.law/recap/), [FAQs](https://free.law/recap/faq/), and [screenshots](http://free.law/recap/screenshots/) are updated.
 - Shift focus to support: Rename 'Help' tab to 'Donate' and enhance content.([#359](https://github.com/freelawproject/recap/issues/359), [#356](https://github.com/freelawproject/recap-chrome/pull/356)).


## 2.4.2 (2023-12-15)

Features: 
 - Adds annual tab popup asking for support from all users (sorry).

Fixes:
 - Add additional appellate attachment page detection logic([#352](https://github.com/freelawproject/recap-chrome/pull/352))


## 2.4.1 (2023-11-17)

Changes:
 - Enhanced logic to retrieve Zip URLs([#352](https://github.com/freelawproject/recap/issues/352)).


## 2.4.0 (2023-09-27)

Features:
 - Adds a warning sign to the toolbar icon when users are on a ACMS website([#346](https://github.com/freelawproject/recap-chrome/pull/346))

Changes:
 - Adds permissions to access ACMS URLs. ACMS is the new CM/ECF replacement
   for the Second and Ninth Circuit Courts of Appeals, which goes live
   for all new cases on Oct. 1, 2023.  We do not currently support
   ACMS, but because users have to acknlowledge permissions changes,
   it's important to get that manual step out of the way as soon as
   possible as we work on the code.


## 2.3.0 (2023-07-25)

Features:
 - Adds a warning to let users know that combined PDFs won't be uploaded to the RECAP Archive([#337](https://github.com/freelawproject/recap/issues/337), [#341](https://github.com/freelawproject/recap-chrome/pull/341))

Fixes:
 - More robust logic to inject content scripts([#346](https://github.com/freelawproject/recap/issues/346))


## 2.2.0 (2023-07-13)

Features:
 - Adds RECAP banners to the docket query pages on appellate courts([#335](https://github.com/freelawproject/recap/issues/335), [#333](https://github.com/freelawproject/recap-chrome/pull/333))

Changes:
 - Improve logic to identify attachment pages in district courts([#335](https://github.com/freelawproject/recap-chrome/pull/335))

Fixes:
 - More robust logic to get the document id from appellate courts([#340](https://github.com/freelawproject/recap/issues/340))
 - Normalize document numbers from appellate courts that uses the pacer_doc_id instead of the regular docket entry numbering([#2877](https://github.com/freelawproject/courtlistener/issues/2877)).
 - Remove logic to normalize the pacer_dls_id attribute in the document links([#338](https://github.com/freelawproject/recap-chrome/pull/338))


## 2.1.0 (2023-06-30)

Features:
 - PDFs containing audio recordings will now be uploaded to the RECAP Archive ([#244](https://github.com/freelawproject/recap/issues/244), [#326](https://github.com/freelawproject/recap-chrome/pull/326))

Fixes:
 - Fix button to autofill docket query form([#344](https://github.com/freelawproject/recap/issues/344)).


## 2.0.2 (2023-06-08)

Fixes:
 - Better document link filtering on district and appellate court reports([#341](https://github.com/freelawproject/recap/issues/341)).
 - Better case ID capturing on district court docket reports.

For developers:
 - Change the naming style of the data attributes the extension attaches to documents links.


## 2.0.1 (2023-01-26)

Changes:
 - Uncheck terminates parties field of docket query form in district courts([#329](https://github.com/freelawproject/recap/issues/329), [#313](https://github.com/freelawproject/recap-chrome/pull/313))

Fixes:
 - More robust uploading of case summary pages from appellate ([#330](https://github.com/freelawproject/recap/issues/330))


## 2.0.0 (2023-01-10)

Features:
 - Add support to upload documents from appellate courts ([#316](https://github.com/freelawproject/recap/issues/316), [#296](https://github.com/freelawproject/recap-chrome/pull/296) ).
 - Add banners to advertise RECAP Email in appellate courts ([#313](https://github.com/freelawproject/recap/issues/313), [#295](https://github.com/freelawproject/recap-chrome/pull/295)).
 - Add links to review RECAP in the extension Popup ([#286](https://github.com/freelawproject/recap/issues/286), [#303](https://github.com/freelawproject/recap-chrome/pull/303))
 - Upload free documents from Appellate PACER ([#322](https://github.com/freelawproject/recap/issues/322), [#305](https://github.com/freelawproject/recap-chrome/pull/305))
 - Add button to autofill docket query form in district courts ([#311](https://github.com/freelawproject/recap-chrome/pull/311), [#190](https://github.com/freelawproject/recap/issues/190))

Changes:
 - None yet

Fixes: 
 - More robust uploading of case query pages([#321](https://github.com/freelawproject/recap/issues/321), [#2419](https://github.com/freelawproject/courtlistener/issues/2419),)
 - Add the caseId parameter to doc links in Appellate Pacer ([#324](https://github.com/freelawproject/recap/issues/324))
 - Remove checks that were disabling the extension ([#325](https://github.com/freelawproject/recap/issues/325))

For developers:
 - Nothing yet


## 1.2.31 (2022-12-16)

Features:
 - Beta support for the appellate courts is finally here. It's missing a few parts, but will start uploading docket and attachment pages now. We'll collect those and work on merging them into the RECAP Archive, and the next version will add support for uploading documents and telling you when we have content in the archive. For now, we thank you for being so very patient over the many years, and we're excited to start collecting _something_! The real deal is coming, and feel free to report bugs if you find them.

 - Add an actions button to PACER docket pages ([#308](https://github.com/freelawproject/recap/issues/308), [#282](https://github.com/freelawproject/recap-chrome/pull/282))

 - Adds annual tab popup asking for support from all users (sorry).

Changes:
 - Remove option to "Confirm before opening RECAP documents". This option really just slowed down our users, so we finally removed it.  ([#216](https://github.com/freelawproject/recap/issues/216))
 - Now we upload iquery.pl docket summary page from district courts, so we can get even more information into RECAP. ([#251](https://github.com/freelawproject/recap/issues/251))
 
Fixes: 
 - Tighten security by verifying the sender's identity in communication between Window objects. This prevents a theoretical attack vector that might, with a lot of care and effort, have been able to send bad data to the RECAP Archive. We have no evidence of this ever being abused. ([#236](https://github.com/freelawproject/recap/issues/236))
 - Fix logic to handle links from appellate PACER to district PACER ([#222](https://github.com/freelawproject/recap/issues/222))
 - Fix logic to avoid duplicating RECAP banners ([#318](https://github.com/freelawproject/recap/issues/318))
 - Better case ID capturing on district court docket pages ([#319](https://github.com/freelawproject/recap/issues/319))
 - Fix Refresh links button in appellate pages ([#328](https://github.com/freelawproject/recap/issues/328))


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
