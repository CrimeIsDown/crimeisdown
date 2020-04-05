/*eslint-disable no-console*/
import Application from '@ember/application';
import * as Sentry from '@sentry/browser'
import * as Integrations from '@sentry/integrations';
import Resolver from 'ember-resolver';
import loadInitializers from 'ember-load-initializers';
import config from './config/environment';

if (config.sentry) {
  Sentry.init({
    dsn: config.sentry.dsn,
    integrations: [new Integrations.Ember()]
    /*beforeSend: (event, hint) => {
      console.error(hint.originalException || hint.syntheticException);
      return event;
    }*/
  });
}

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  podModulePrefix = config.podModulePrefix;
  Resolver = Resolver;
}

loadInitializers(App, config.modulePrefix);
