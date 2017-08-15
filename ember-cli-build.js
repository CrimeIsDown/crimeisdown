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

  app.import('vendor/raven-js/dist/raven.js');
  app.import('vendor/raven-js/dist/plugins/ember.js');

  app.import('vendor/popper.js/dist/umd/popper.js');

  app.import({
    development: 'vendor/bootstrap/dist/js/bootstrap.js',
    production: 'vendor/bootstrap/dist/js/bootstrap.min.js'
  });

  app.import({
    development: 'vendor/bootstrap-table/dist/bootstrap-table.js',
    production: 'vendor/bootstrap-table/dist/bootstrap-table.min.js'
  });

  app.import({
    development: 'vendor/bootstrap-table/dist/bootstrap-table.css',
    production: 'vendor/bootstrap-table/dist/bootstrap-table.min.css'
  });

  app.import({
    development: 'vendor/rome/dist/rome.js',
    production: 'vendor/rome/dist/rome.min.js'
  });

  app.import({
    development: 'vendor/rome/dist/rome.css',
    production: 'vendor/rome/dist/rome.min.css'
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
