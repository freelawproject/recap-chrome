What is this?
=============
This is the code for the RECAP Chrome extension, a program that is used to
liberate millions of documents from the PACER system. To install this extension
please visit the [Chrome Store][1].


Joining as a Developer
======================
If you wish to contribute to our efforts to drain PACER, please get in touch
using the [contact form on Free Law Project's website][contact].

We also have [a development mailing list][dev], where we sometimes discuss things.

Finally, there's no reason you can't just start forking and hacking on this
code. There are always lots of bugs and feature requests in the queue.

Tips
----
1. While it's true that every court has their own customized version of PACER,
   there is [a PACER training site that does not charge fees][trainwreck]. You
   can use this if you wish to work on the system without accruing charges.


Tests
=====
We got that! You can (and should) run the tests before you push. To do that,
install the dependencies described in `package.json`, and then run:

    grunt jasmine

If the tests pass, give a push to your repo and send us a pull request.

When we pull your code using Github, these tests will be automatically run by
the [Travis-CI][tci] continuous integration system. You can make sure that your
pull request is good to go by waiting for the automated tests to complete.

The current status if Travis CI on our master branch is:

[![Build Status](https://travis-ci.org/freelawproject/recap-chrome.svg?branch=master)][12]


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
[contact]: http://freelawproject.org/contact/
[dev]: http://lists.freelawproject.org/cgi-bin/mailman/listinfo/dev
[12]: https://travis-ci.org/freelawproject/recap-chrome
[tci]: https://travis-ci.org/
[trainwreck]: https://dcecf.psc.uscourts.gov/cgi-bin/login.pl
