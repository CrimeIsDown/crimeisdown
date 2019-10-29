/*eslint-disable no-console*/
import Application from '@ember/application';
import * as Sentry from '@sentry/browser'
import * as Integrations from '@sentry/integrations';
import Resolver from './resolver';
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

const App = Application.extend({
  modulePrefix: config.modulePrefix,
  podModulePrefix: config.podModulePrefix,
  Resolver
});

loadInitializers(App, config.modulePrefix);

export default App;
