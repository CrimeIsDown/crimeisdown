/* eslint-env node */
'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
// const Funnel = require('broccoli-funnel');
const AssetRev = require('broccoli-asset-rev');

module.exports = function(defaults) {
  let app = new EmberApp(defaults, {
    'ember-cli-babel': {
      includePolyfill: true
    }
  });

  app.import('vendor/raven-js/dist/raven.js');
  app.import('vendor/raven-js/dist/plugins/ember.js');

  app.import('vendor/popper.js/dist/umd/popper.js');
  app.import('vendor/bootstrap/dist/js/bootstrap.js');

  app.import('vendor/bootstrap-table/dist/bootstrap-table.js');
  app.import('vendor/bootstrap-table/dist/bootstrap-table.css');

  app.import('vendor/rome/dist/rome.js');
  app.import('vendor/rome/dist/rome.css');

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
