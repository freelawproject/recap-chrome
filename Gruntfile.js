module.exports = function(grunt) {
  grunt.initConfig({
    jasmine : {
      src : [
        'pacer.js',
        'recap.js',
        'utils.js'
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
