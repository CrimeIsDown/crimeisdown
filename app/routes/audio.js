import Route from '@ember/routing/route';
import fetch from 'fetch';

export default class AudioRoute extends Route {
  async model() {
    let model = {};

    const response = await fetch('/data/audio_data/online_streams.json');
    model.streams = await response.json();

    return model;
  }
}
