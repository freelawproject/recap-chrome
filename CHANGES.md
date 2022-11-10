# Change Log

## Upcoming

The following changes are not yet released, but are code complete:

Features:
- None

Changes:
- None

Fixes:
- None

## Current

**1.2.30 - 2022-11-09**

Changes:
 - Remove references to Travis CI in readme.md and testing.md files.
 - Delete the configuration file for Travis CI.
 - Add the test.yml file to define a workflow that runs tests using GitHub Actions.
 - Adds [Puppeteer](https://pptr.dev/) as a dev dependency to use its Chromium binary to run the tests in [headless](https://developers.google.com/web/updates/2017/04/headless-chrome) mode.
 - Update the configuration file used by Karma to change the default browser used to run the tests.