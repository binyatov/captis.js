/**
  @fileoverview main Grunt task file
**/
'use strict';

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    //browserify
    browserify: {
      client:{
        files: {
          'dist/captis.js': ['./captis.js']
        },
        options:{
          debug: true,
          shim:{
            Whammy:{
              path: 'vendor/whammy.min.js',
              exports: "Whammy"
            },
            Editor:{
              path: 'editor.js',
              exports: "Editor"
            },
          }
       }
      }
    },

    //jshint
    jshint: {
      all: ['Gruntfile.js', '.js']
    },

    //uglify
    uglify: {
      options: {
        screw_ie8 : true,
        mangle:false,
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        files: {
          'dist/captis.min.js' : ['dist/captis.js']
        }
      }
    },

    //watch
    watch: {
      options:{
        livereload: true
      },
      client: {
        files: ['vendor/**/*.js', '*.js', 'css/*.css'],
        tasks: ['browserify', 'uglify'],
        options: {
          spawn: false
          // interrupt: true
        },
      },
    }
  });

  // Our custom tasks.
  grunt.registerTask('default', ['build']);
  grunt.registerTask('build', ['browserify', 'uglify', 'watch']);


  //npm tasks
  require('load-grunt-tasks')(grunt);
};