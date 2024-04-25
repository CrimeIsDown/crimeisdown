/*eslint-disable no-console*/

import Route from '@ember/routing/route';
import fetch from 'fetch';

export default class AudioLiveRoute extends Route {
  queryParams = {
    autoplay: {
      refreshModel: true,
    },
  };

  autoplay = false;

  async model(params) {
    params.autoplay = params.autoplay === 'true';

    try {
      const response = await fetch('/data/audio_data/online_streams.json');
      const onlineStreams = await response.json();
      const stream = onlineStreams.filter(
        (stream) => stream.slug === params.stream,
      )[0];
      if (stream) {
        return stream;
      }
    } catch (error) {
      console.error(error);
    }
    params.slug = params.stream;
    delete params.stream;
    return params;
  }
}
