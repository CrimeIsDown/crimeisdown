import Ember from 'ember';
import config from './config/environment';

const Router = Ember.Router.extend({
  location: config.locationType
});

Router.map(function() {
  this.route('map');
  this.route('directives');
  this.route('guide');
  this.route('audio');
});

export default Router;
