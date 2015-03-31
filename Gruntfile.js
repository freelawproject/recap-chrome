module.exports = function(grunt) {
  grunt.initConfig({
    jasmine : {
      src : 'pacer.js',
      options: {
        specs : 'spec/**/*Spec.js',
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jasmine');

  grunt.registerTask('default', 'jasmine');
};
