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
            Add:{
                path: 'add.js',
                exports: "Add"
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

    //compass

    compass: {
        dev: {
            options: {
                sassDir: ['sass'],
                cssDir: ['css'],
                environment: 'development'
            }
        },
        prod: {
            options: {
                sassDir: ['sass'],
                cssDir: ['css'],
                environment: 'production'
            }
        }
    },

    //watch
    watch: {
      options:{
        livereload: true
      },
      client: {
        files: ['vendor/**/*.js', '*.js'],
        tasks: ['browserify', 'uglify'],
        options: {
          spawn: false
          // interrupt: true
        }
      },
      compass: {
          files: ['sass/*.scss'],
          tasks: ['compass:dev']
      }
    }
  });

  // Our custom tasks.
  grunt.registerTask('default', ['build']);
  grunt.registerTask('build', ['browserify', 'uglify', 'compass:dev', 'watch']);


  //npm tasks
  require('load-grunt-tasks')(grunt);
};
