import EmberRouter from '@ember/routing/router';

import config from 'crimeisdown/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('map');
  this.route('directives');
  this.route('guide');
  this.route('audio');
  this.route('sirens');
  this.route('not-found', {
    path: '/*path',
  });
  this.route('archiveplayer', {
    path: '/audio/archive/:filename',
  });
  this.route('archiveplayer', {
    path: '/audio/archive',
  });
  this.route('audio-live', {
    path: '/audio/live/:stream',
  });
  this.route('search-transcripts', {
    path: '/transcripts/search',
  });
  this.route('notifications', {
    path: '/transcripts/notifications',
  });
  this.route('settings');
});
