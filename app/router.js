import Ember from 'ember';
import RouterScroll from 'ember-router-scroll';
import config from './config/environment';
import googlePageview from './mixins/google-pageview';

const Router = Ember.Router.extend(RouterScroll, googlePageview, {
  location: config.locationType,
  rootURL: config.rootURL
});

Router.map(function() {
  this.route('map');
  this.route('directives');
  this.route('guide');
  this.route('audio');
  this.route('not-found', {
    path: '/*path'
  });
});

export default Router;
