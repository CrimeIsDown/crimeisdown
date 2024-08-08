import Route from '@ember/routing/route';
import fetch from 'fetch';

export default class AudioRoute extends Route {
  async model() {
    let model = {};

    const response = await fetch('/data/audio_data/online_streams.json');
    model.streams = await response.json();

    try {
      const ytResponse = await fetch(
        'https://worker.erictendian.workers.dev/youtubelive/',
      );
      const ytResponseData = await ytResponse.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(ytResponseData, 'text/html');
      model.youtubeEmbedUrl = doc.querySelector(
        'meta[property="og:video:secure_url"]',
      ).attributes.content.value;
    } catch (e) {
      console.error('Error fetching YouTube data', e);
    }

    return model;
  }
}
