import Application from '@ember/application';
import * as Sentry from '@sentry/browser'
import * as Integrations from '@sentry/integrations';
import Resolver from './resolver';
import loadInitializers from 'ember-load-initializers';
import config from './config/environment';

Sentry.init({
  dsn: 'https://fc1365bf53c34718b4674383752e1080@sentry.io/154438',
  integrations: [new Integrations.Ember()]
});

const App = Application.extend({
  modulePrefix: config.modulePrefix,
  podModulePrefix: config.podModulePrefix,
  Resolver
});

loadInitializers(App, config.modulePrefix);

export default App;
