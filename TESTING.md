# Testing the extension

The extension features a number of unit tests written in
[Jasmine](http://jasmine.github.io/). There are a few steps necessary to run
them.

## You will need

* Node and npm

## Running the tests

The tests are designed to be run with a headless browser (aka
[PhantomJS](http://phantomjs.org/)). They are also designed to be run using
the [Grunt](http://gruntjs.com/) task runner. This is where the dependency on
Node comes from.

0. Install [Node and npm](https://nodejs.org/)
0. In the project directory, `npm install grunt`
0. Then, `npm install -g grunt-cli`
0. Finally, `npm install grunt-contrib-jasmine`. It seems like this step will      install PhantomJS for you if you require it, as a dependency.

All of these packages, except for `grunt-cli`, are installed in the project
folder in the node_modules directory (which is part of `.gitignore`).

Finally it's as simple as:
```
grunt
```
or
```
grunt jasmine
```
which is the default Grunt task.
