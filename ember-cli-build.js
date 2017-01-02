/*jshint node:true*/
/* global require, module */
var EmberApp = require('ember-cli/lib/broccoli/ember-app');
// var Funnel = require('broccoli-funnel');
var AssetRev = require('broccoli-asset-rev');

module.exports = function(defaults) {
  var app = new EmberApp(defaults, {
    // Add options here
  });

  // Use `app.import` to add additional libraries to the generated
  // output files.
  //
  // If you need to use different assets in different
  // environments, specify an object as the first parameter. That
  // object's keys should be the environment name and the values
  // should be the asset to use in that environment.
  //
  // If the library that you are including contains AMD or ES6
  // modules that you would like to import into your application
  // please specify an object with the list of modules as keys
  // along with the exports of each module as its value.

  app.import({
    development: 'vendor/bootstrap-sass/assets/javascripts/bootstrap.js',
    production: 'vendor/bootstrap-sass/assets/javascripts/bootstrap.min.js'
  });

  app.import({
    development: 'vendor/bootstrap-table/dist/bootstrap-table.css',
    production: 'vendor/bootstrap-table/dist/bootstrap-table.min.css'
  });
  app.import({
    development: 'vendor/bootstrap-table/dist/bootstrap-table.js',
    production: 'vendor/bootstrap-table/dist/bootstrap-table.min.js'
  });

  app.import('vendor/leaflet/dist/images/layers.png', {destDir: 'assets/images'});
  app.import('vendor/leaflet/dist/images/layers-2x.png', {destDir: 'assets/images'});
  app.import('vendor/leaflet/dist/images/marker-icon.png', {destDir: 'assets/images'});
  app.import('vendor/leaflet/dist/images/marker-icon-2x.png', {destDir: 'assets/images'});
  app.import('vendor/leaflet/dist/images/marker-shadow.png', {destDir: 'assets/images'});

  return app.toTree();
};
