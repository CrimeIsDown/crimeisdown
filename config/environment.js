/* eslint-env node */
'use strict';

module.exports = function(environment) {
  let ENV = {
    modulePrefix: 'crimeisdown',
    environment,
    rootURL: '/',
    locationType: 'router-scroll',
    historySupportMiddleware: true,
    EmberENV: {
      FEATURES: {
        // Here you can enable experimental features on an ember canary build
        // e.g. 'with-controller': true
      },
      EXTEND_PROTOTYPES: {
        // Prevent Ember Data from overriding Date.parse.
        Date: false
      }
    },

    APP: {
      // Here you can pass flags/options to your application instance
      // when it is created
      MEDIA_PLAYER_DEBUG: false
    },
    fastboot: {
      hostWhitelist: ['crimeisdown.com', 'dev.crimeisdown.com', /^localhost:\d+$/]
    }
  };

  if (environment === 'development') {
    // ENV.APP.LOG_RESOLVER = true;
    // ENV.APP.LOG_ACTIVE_GENERATION = true;
    // ENV.APP.LOG_TRANSITIONS = true;
    // ENV.APP.LOG_TRANSITIONS_INTERNAL = true;
    // ENV.APP.LOG_VIEW_LOOKUPS = true;
    ENV.firebase = {
      apiKey: "REDACTED_PUBLIC_CREDENTIAL",
      authDomain: "crimeisdown-dev.firebaseapp.com",
      databaseURL: "https://crimeisdown-dev.firebaseio.com",
      storageBucket: "crimeisdown-dev.appspot.com"
    };
  }

  if (environment === 'test') {
    // Testem prefers this...
    ENV.locationType = 'none';

    // keep test console output quieter
    ENV.APP.LOG_ACTIVE_GENERATION = false;
    ENV.APP.LOG_VIEW_LOOKUPS = false;

    ENV.APP.rootElement = '#ember-testing';
  }

  if (environment === 'production') {
    ENV.googleAnalytics = {
      webPropertyId: 'UA-EXAMPLE-1'
    };
    ENV.firebase = {
      apiKey: "REDACTED_PUBLIC_CREDENTIAL",
      authDomain: "crimeisdown.firebaseapp.com",
      databaseURL: "https://crimeisdown.firebaseio.com",
      storageBucket: "crimeisdown.appspot.com"
    };
    ENV.APP.MEDIA_PLAYER_DEBUG = false;
  }

  return ENV;
};
