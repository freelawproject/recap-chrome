# Testing the extension

The extension features a number of unit tests written in
[Jasmine](http://jasmine.github.io/). There are a few steps necessary to run
them.

## You will need

* Node and npm
* [Google Chrome](https://www.google.com/chrome/browser/desktop/index.html)

## Running the tests

The tests are designed to be run with Chrome, either headless (as they run on
Travis CI) or otherwise. They are launched using the
[Karma test runner](https://karma-runner.github.io/2.0/index.html), which can
be installed using npm.

1. Install [Node and npm](https://nodejs.org/).
1. In the project directory, `npm install`
1. (optional) `npm install -g karma-cli`. If you don't, replace `karma` with
`node_modules/.bin/karma` in the step below.
1. Finally, `karma start` or `karma start --browsers Chrome_CI` for headless.

All of the necessary node packages are installed in the project folder in the
node_modules directory (which is part of `.gitignore`).

## Running once

By default, karma runs in an 'iterative' mode, where it watches input files and
editing test or source code instantly causes the test suite to be re-run. If
you'd like to only do a single pass of the test suite, pass karma the flag
`--single-run`.

## Adding additional browsers/launchers

It shouldn't be too hard to add additional browsers/launchers. Simply:

0. `npm install --save-dev karma-somebrowser-launcher`
0. Add the new launcher to the plugins section of `karma.conf.js`
0. Run `karma start --browsers SomeBrowser`
