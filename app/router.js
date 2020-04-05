import EmberRouter from '@ember/routing/router';
import RouterScroll from 'ember-router-scroll';
import config from './config/environment';
import googlePageview from './mixins/google-pageview';

export default class Router extends EmberRouter.extend(RouterScroll, googlePageview) {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function() {
  this.route('map');
  this.route('directives');
  this.route('guide');
  this.route('audio');
  this.route('sirens');
  this.route('not-found', {
    path: '/*path'
  });
  this.route('archiveplayer', {
    path: '/audio/archive/:filename'
  });
  this.route('archiveplayer', {
    path: '/audio/archive'
  });
  this.route('audio-live', {
    path: '/audio/live/:stream'
  });
});
