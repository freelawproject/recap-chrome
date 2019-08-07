[![Build Status](https://travis-ci.org/freelawproject/recap-chrome.svg?branch=master)][12] 


What is this?
=============
This is the code for the RECAP Chrome and Firefox extensions, programs that are
used to liberate millions of documents from the PACER system. To install this extension
please visit its homepage at https://free.law/recap/.


Reporting Issues
================
Issues go one of a few places:

 - For issues related to the RECAP server, please file them [in 
 CourtListener][cl].
 
 - For issues related to the RECAP Extensions, please report them at [the
  centralized RECAP issue repo][recap-issues]. 


Joining as a Developer
======================
If you wish to contribute to our efforts to drain PACER, please get in touch using the [contact form on Free Law Project's website][contact] or simply get to work on an issue that interests you. It's usually better to get in touch before you begin work though.


Code Standards
--------------
1. We have an eslint configuration. Please use it. There are probably plugins for your editor to help you with this. 

1. For commits, please adhere to [the guidance published here][commits]. Intellij has a plugin to help with this. Look for "Git Commit Template".

Tips for Making Extensions
--------------------------
1. The weirdest thing about working on extensions is that you need to have two developer tool windows open simultaneously. One for the page you're on and how the extension interacts with it, and the other for the background page of the extension. You'll just have to live like this. Having multiple monitors helps. Read on for how to set this up.

1. You can load an "unpacked extension" from [chrome://extensions/][c] if you enable developer options in Chrome. The same [can be accomplished in Firefox][tempff] by going to [about:debugging][abtdbg], clicking "Load Temporary Add-on" and then selecting any file.

    Once you have the unpacked extension loaded, you'll see a button to debug it. Click that to open the second developer tools window mentioned just above. 

1. While it's true that every court has their own customized version of PACER, there is [a PACER training site that does not charge fees][trainwreck]. You can use this if you wish to work on the system without accruing charges. If you are accruing charges while working on this extension, Free Law Project may be able to help. Let us know.

1. If you want to auto-zip your code on changes, you have two options. First, you can install a utility called `entr` and run:

        command ls *.js | entr zip -FSr recap-chrome.zip * --exclude=*node_modules*
    
    Alternatively, for Firefox, you can use the [web-ext][we] tool, with a command like:
     
        web-ext run --firefox-profile recap-debugging --start-url https://ecf.dcd.uscourts.gov/cgi-bin/DktRpt.pl?178502 --start-url https://www.courtlistener.com/docket/4214664/national-veterans-legal-services-program-v-united-states/
    
    To run that you'll need a `recap-debugging` profile first, but running that will set up auto-reload of the extension in Firefox. It will also load a couple useful URLs in your debugging window.
    
    

Running Tests
=============
You can (and should) run the tests before you push. If you don't, you'll be disappointed when our continuous integration suite yells at you. To run tests, install the dependencies described in `package.json` by running:

   npm install
   
You will need Chrome installed. Then run:

    karma start --single-run

If the tests pass, give a push to your repo and send us a pull request.

When we pull your code using Github, these tests will be automatically run by
the [Travis-CI][tci] continuous integration system. You can make sure that your
pull request is good to go by waiting for the automated tests to complete.

For more information on testing see [TESTING.md][testingmd].

The current status of Travis CI on our master branch is:

[![Build Status](https://travis-ci.org/freelawproject/recap-chrome.svg?branch=master)][12]


Releasing a New Version
=======================
When a new version is needed, the release process is:

1. Update `package.json` and `manifest.json` with a new release version.
1. Run `web-ext lint` to ensure no regressions.
1. Commit the code.
1. Tag the code with something like:

        git tag -s '0.8.4' -m "Releases 0.8.4, fixing replaceState and pushState to work in Chrome 43." -u 'mike@freelawproject.org' -f
        git push --tags -f

1. Make sure you don't have any working/testing code in your tree that could get zipped up in the next step.
1. Zip up the archive with the rather archaic:

        zip -FSr recap.zip *

1. Upload that to the [Chrome Market][market].
1. Upload that to addons.mozilla.org
1. Make a new release on [Github announcing the release][ghtags].


Copyright
=========

RECAP for Chrome
Copyright 2013 Ka-Ping Yee <ping@zesty.ca>

RECAP for Chrome is free software: you can redistribute it and/or modify it
under the terms of the GNU General Public License as published by the Free
Software Foundation, either version 3 of the License, or (at your option)
any later version.  RECAP for Chrome is distributed in the hope that it will
be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General
Public License for more details.

You should have received a copy of the GNU General Public License along with
RECAP for Chrome.  If not, see: http://www.gnu.org/licenses/


[1]: https://chrome.google.com/webstore/detail/recap/oiillickanjlaeghobeeknbddaonmjnc
[contact]: http://free.law/contact/
[12]: https://travis-ci.org/freelawproject/recap-chrome
[tci]: https://travis-ci.org/
[trainwreck]: https://dcecf.psc.uscourts.gov/cgi-bin/login.pl
[testingmd]: https://github.com/freelawproject/recap-chrome/blob/master/TESTING.md
[market]: https://chrome.google.com/webstore/developer/edit/oiillickanjlaeghobeeknbddaonmjnc?authuser=3#
[ghtags]: https://github.com/freelawproject/recap-chrome/releases/new
[csv-json]: https://court-version-scraper.herokuapp.com/courts.json
[csv-html]: https://court-version-scraper.herokuapp.com/
[ad]: https://github.com/audiodude
[c]: chrome://extensions/
[we]: https://github.com/mozilla/web-ext/
[abtdbg]: about:debugging
[tempff]: https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Temporary_Installation_in_Firefox
[cl]: https://github.com/freelawproject/courtlistener/issues/new
[recap-issues]: https://github.com/freelawproject/recap/issues
[commits]: https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#-git-commit-guidelines
