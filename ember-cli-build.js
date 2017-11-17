/* eslint-env node */
'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
// const Funnel = require('broccoli-funnel');
const AssetRev = require('broccoli-asset-rev');

module.exports = function(defaults) {
  let app = new EmberApp(defaults, {
    outputPaths: {
      app: {
        css: {
          'app': '/assets/crimeisdown.css',
          'app-dark': '/assets/crimeisdown-dark.css'
        }
      }
    },
    'ember-cli-babel': {
      includePolyfill: true
    },
    fingerprint: {
      exclude: [
        'assets/images/layers-2x.png',
        'assets/images/layers.png',
        'assets/images/marker-icon-2x.png',
        'assets/images/marker-icon.png',
        'assets/images/marker-shadow.png'
      ]
    }
  });

  app.import('node_modules/raven-js/dist/raven.js');
  app.import('node_modules/raven-js/dist/plugins/ember.js');

  app.import('node_modules/popper.js/dist/umd/popper.js');
  app.import('node_modules/bootstrap/dist/js/bootstrap.js');

  app.import('node_modules/bootstrap-table/dist/bootstrap-table.js');
  app.import('node_modules/bootstrap-table/dist/bootstrap-table.css');

  app.import('node_modules/sortablejs/Sortable.js');

  app.import('node_modules/flatpickr/dist/flatpickr.js');
  app.import('node_modules/flatpickr/dist/flatpickr.css');

  app.import('node_modules/leaflet/dist/images/layers.png', {destDir: 'assets/images'});
  app.import('node_modules/leaflet/dist/images/layers-2x.png', {destDir: 'assets/images'});
  app.import('node_modules/leaflet/dist/images/marker-icon.png', {destDir: 'assets/images'});
  app.import('node_modules/leaflet/dist/images/marker-icon-2x.png', {destDir: 'assets/images'});
  app.import('node_modules/leaflet/dist/images/marker-shadow.png', {destDir: 'assets/images'});

  app.import('node_modules/font-awesome/fonts/FontAwesome.otf', {destDir: 'assets/fonts'});
  app.import('node_modules/font-awesome/fonts/fontawesome-webfont.eot', {destDir: 'assets/fonts'});
  app.import('node_modules/font-awesome/fonts/fontawesome-webfont.svg', {destDir: 'assets/fonts'});
  app.import('node_modules/font-awesome/fonts/fontawesome-webfont.ttf', {destDir: 'assets/fonts'});
  app.import('node_modules/font-awesome/fonts/fontawesome-webfont.woff', {destDir: 'assets/fonts'});
  app.import('node_modules/font-awesome/fonts/fontawesome-webfont.woff2', {destDir: 'assets/fonts'});

  return app.toTree();
};
