module.exports = function(grunt) {
  grunt.initConfig({
    jasmine : {
      src : [
        'assets/js/jquery-3.2.1.js',
        'notifier.js',
        'pacer.js',
        'recap.js',
        'toolbar_button.js',
        'utils.js',
        'test/mock-utils.js',
        'content_delegate.js',
      ],
      options: {
        specs : 'spec/**/*Spec.js',
        helpers: 'test/mock-ajax.js',
        polyfills: 'test/Blob.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jasmine');

  grunt.registerTask('default', 'jasmine');
};
