import Ember from 'ember';

export default Ember.Route.extend({
  model() {
    return Ember.$.getJSON('/data/audio_data/online_streams.json');
  }
});
