import Route from '@ember/routing/route';
import fetch from 'fetch';

export default class AudioRoute extends Route {
  model() {
    return fetch('/data/audio_data/online_streams.json').then((response) => {
      return response.json();
    });
  }
}
