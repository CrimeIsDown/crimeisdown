/* eslint-env node */
const EmberApp = require('ember-cli/lib/broccoli/ember-app');
// const Funnel = require('broccoli-funnel');
const AssetRev = require('broccoli-asset-rev');

module.exports = function(defaults) {
  var app = new EmberApp(defaults, {
    'ember-cli-babel': {
      includePolyfill: true
    }
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

  app.import('vendor/raven-js/dist/raven.js');
  app.import('vendor/raven-js/dist/plugins/ember.js');

  app.import({
    development: 'vendor/bootstrap-sass/assets/javascripts/bootstrap.js',
    production: 'vendor/bootstrap-sass/assets/javascripts/bootstrap.min.js'
  });

  app.import({
    development: 'vendor/bootstrap-material-design/dist/js/material.js',
    production: 'vendor/bootstrap-material-design/dist/js/material.min.js'
  });

  app.import({
    development: 'vendor/bootstrap-material-design/dist/js/ripples.js',
    production: 'vendor/bootstrap-material-design/dist/js/ripples.min.js'
  });

  app.import({
    development: 'vendor/bootstrap-table/dist/bootstrap-table.css',
    production: 'vendor/bootstrap-table/dist/bootstrap-table.min.css'
  });
  app.import({
    development: 'vendor/bootstrap-table/dist/bootstrap-table.js',
    production: 'vendor/bootstrap-table/dist/bootstrap-table.min.js'
  });

  app.import({
    development: 'vendor/bootstrap-datetime-picker/css/bootstrap-datetimepicker.css',
    production: 'vendor/bootstrap-datetime-picker/css/bootstrap-datetimepicker.min.css'
  });
  app.import({
    development: 'vendor/bootstrap-datetime-picker/js/bootstrap-datetimepicker.js',
    production: 'vendor/bootstrap-datetime-picker/js/bootstrap-datetimepicker.min.js'
  });

  app.import('vendor/leaflet/dist/images/layers.png', {destDir: 'assets/images'});
  app.import('vendor/leaflet/dist/images/layers-2x.png', {destDir: 'assets/images'});
  app.import('vendor/leaflet/dist/images/marker-icon.png', {destDir: 'assets/images'});
  app.import('vendor/leaflet/dist/images/marker-icon-2x.png', {destDir: 'assets/images'});
  app.import('vendor/leaflet/dist/images/marker-shadow.png', {destDir: 'assets/images'});

  app.import('vendor/font-awesome/fonts/FontAwesome.otf', {destDir: 'assets/fonts'});
  app.import('vendor/font-awesome/fonts/fontawesome-webfont.eot', {destDir: 'assets/fonts'});
  app.import('vendor/font-awesome/fonts/fontawesome-webfont.svg', {destDir: 'assets/fonts'});
  app.import('vendor/font-awesome/fonts/fontawesome-webfont.ttf', {destDir: 'assets/fonts'});
  app.import('vendor/font-awesome/fonts/fontawesome-webfont.woff', {destDir: 'assets/fonts'});
  app.import('vendor/font-awesome/fonts/fontawesome-webfont.woff2', {destDir: 'assets/fonts'});

  return app.toTree();
};
