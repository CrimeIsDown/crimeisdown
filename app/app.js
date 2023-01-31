/*eslint-disable no-console*/
import Application from '@ember/application';
import Resolver from 'ember-resolver';
import loadInitializers from 'ember-load-initializers';
import config from 'crimeisdown/config/environment';

import * as Sentry from '@sentry/ember';

Sentry.init({
  dsn: 'https://fc1365bf53c34718b4674383752e1080@o71971.ingest.sentry.io/154438',
  enabled: config.environment === 'production',
  environment: config.environment,
  denyUrls: ['platform.twitter.com'],
  release: config.APP.version,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [new Sentry.Replay()],
});

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  podModulePrefix = config.podModulePrefix;
  Resolver = Resolver;
}

loadInitializers(App, config.modulePrefix);
