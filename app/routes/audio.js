import Route from '@ember/routing/route';
import fetch from 'fetch';

export default class AudioRoute extends Route {
  async model() {
    const response = await fetch('/data/audio_data/online_streams.json')
    return response.json();
  }
}
