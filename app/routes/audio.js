import Route from '@ember/routing/route';
import fetch from 'fetch';

export default Route.extend({
  model() {
    return fetch('https://crimeisdown.com/data/audio_data/online_streams.json')
      .then((response) => {
        return response.json();
      });
  }
});
