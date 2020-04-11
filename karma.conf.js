// Karma configuration
// Generated on Wed Jan 03 2018 21:51:16 GMT-0800 (PST)

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    plugins: [
      'karma-jasmine',
      'karma-jasmine-ajax',
      'karma-chrome-launcher',
      'karma-jquery',
      'karma-coverage'
    ],

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine-ajax', 'jasmine', 'jquery-3.2.1'],

    // list of files / patterns to load in the browser
    files: [
      { pattern: 'node_modules/whatwg-fetch/fetch.js', type: 'module' },
      'src/assets/js/FileSaver.js',
      'src/notifier.js',
      'src/pacer.js',
      'src/recap.js',
      'src/toolbar_button.js',
      'src/utils.js',
      'test/mock-utils.js',
      'src/content_delegate.js',
      'spec/*Spec.js',
    ],


    // list of files / patterns to exclude
    exclude: [
    ],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'src/**/*.js': 'coverage'
    },


    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress', 'coverage'],


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,




    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['Chrome'],

    // set these options to view logs in development
    // see https://github.com/karma-runner/karma/issues/2582#issuecomment-413660796 
    // browserConsoleLogOptions: {
    //   level: 'log',
    //   format: '%b %T: %m',
    //   terminal: true,
    // },
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_DEBUG,

    client: {
      captureConsole: true,
    },
    
    customLaunchers: {
      Chrome_CI: {
        base: 'Chrome',
        flags: [
          '--no-sandbox',
          '--headless',
          '--disable-gpu',
          '--remote-debugging-port=9222',
        ]
      }
    },

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity
  })
};
