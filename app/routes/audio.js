import Ember from 'ember';
import fetch from 'fetch';

export default Ember.Route.extend({
  model() {
    return fetch('https://dev.crimeisdown.com/data/audio_data/online_streams.json')
      .then((response) => {
        return response.json();
      });
  }
});
