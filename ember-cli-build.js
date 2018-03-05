/* eslint-env node */
'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');

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

  if (app.env === 'production') {
    app.options.inlineContent = {
      'doorbell': 'app/doorbell.js',
      'hotjar': 'app/hotjar.js',
      'raven': 'app/raven.js'
    };
  }

  app.import('node_modules/whatwg-fetch/fetch.js'); // polyfill for fetch() used by leaflet-geosearch

  app.import('node_modules/@mapbox/leaflet-pip/leaflet-pip.js');

  app.import('node_modules/raven-js/dist/raven.js');
  app.import('node_modules/raven-js/dist/plugins/ember.js');

  app.import('node_modules/popper.js/dist/umd/popper.js');
  app.import('node_modules/bootstrap/dist/js/bootstrap.js');

  app.import('node_modules/bootstrap-table/dist/bootstrap-table.js');
  app.import('node_modules/bootstrap-table/dist/bootstrap-table.css');

  app.import('node_modules/sortablejs/Sortable.js');

  app.import('node_modules/flatpickr/dist/flatpickr.js');
  app.import('node_modules/flatpickr/dist/flatpickr.css');

  app.import('node_modules/resonance-audio/build/resonance-audio.js');

  app.import('node_modules/leaflet/dist/leaflet.js');
  app.import('node_modules/leaflet/dist/images/layers.png', {destDir: 'assets/images'});
  app.import('node_modules/leaflet/dist/images/layers-2x.png', {destDir: 'assets/images'});
  app.import('node_modules/leaflet/dist/images/marker-icon.png', {destDir: 'assets/images'});
  app.import('node_modules/leaflet/dist/images/marker-icon-2x.png', {destDir: 'assets/images'});
  app.import('node_modules/leaflet/dist/images/marker-shadow.png', {destDir: 'assets/images'});

  app.import('node_modules/leaflet.gridlayer.googlemutant/Leaflet.GoogleMutant.js');

  app.import('node_modules/leaflet-draw/dist/leaflet.draw.js');
  app.import('node_modules/leaflet-draw/dist/images/spritesheet.png', {destDir: 'assets/images'});
  app.import('node_modules/leaflet-draw/dist/images/spritesheet-2x.png', {destDir: 'assets/images'});
  app.import('node_modules/leaflet-draw/dist/images/spritesheet.svg', {destDir: 'assets/images'});

  app.import('node_modules/leaflet.markercluster/dist/leaflet.markercluster.js');

  app.import('node_modules/leaflet.awesome-markers/dist/leaflet.awesome-markers.js');
  app.import('node_modules/leaflet.awesome-markers/dist/leaflet.awesome-markers.css');
  app.import('node_modules/leaflet.awesome-markers/dist/images/markers-matte.png', {destDir: 'assets/images'});
  app.import('node_modules/leaflet.awesome-markers/dist/images/markers-matte@2x.png', {destDir: 'assets/images'});
  app.import('node_modules/leaflet.awesome-markers/dist/images/markers-plain.png', {destDir: 'assets/images'});
  app.import('node_modules/leaflet.awesome-markers/dist/images/markers-shadow.png', {destDir: 'assets/images'});
  app.import('node_modules/leaflet.awesome-markers/dist/images/markers-shadow@2x.png', {destDir: 'assets/images'});
  app.import('node_modules/leaflet.awesome-markers/dist/images/markers-soft.png', {destDir: 'assets/images'});
  app.import('node_modules/leaflet.awesome-markers/dist/images/markers-soft@2x.png', {destDir: 'assets/images'});

  app.import('node_modules/font-awesome/fonts/FontAwesome.otf', {destDir: 'assets/fonts'});
  app.import('node_modules/font-awesome/fonts/fontawesome-webfont.eot', {destDir: 'assets/fonts'});
  app.import('node_modules/font-awesome/fonts/fontawesome-webfont.svg', {destDir: 'assets/fonts'});
  app.import('node_modules/font-awesome/fonts/fontawesome-webfont.ttf', {destDir: 'assets/fonts'});
  app.import('node_modules/font-awesome/fonts/fontawesome-webfont.woff', {destDir: 'assets/fonts'});
  app.import('node_modules/font-awesome/fonts/fontawesome-webfont.woff2', {destDir: 'assets/fonts'});

  app.import('node_modules/dashjs/dist/dash.mediaplayer.min.js');

  app.import('node_modules/interactjs/dist/interact.js');

  return app.toTree();
};
