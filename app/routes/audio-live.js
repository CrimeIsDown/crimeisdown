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

  model(params) {
    params.autoplay = params.autoplay === 'true';

    return new Promise((resolve) => {
      fetch('/data/audio_data/online_streams.json')
        .then((response) => {
          response
            .json()
            .then((onlineStreams) => {
              const stream = onlineStreams.filter(
                (stream) => stream.slug === params.stream
              )[0];
              if (stream) {
                resolve(stream);
              } else {
                resolve(params);
              }
            })
            .catch((err) => {
              console.error(err);
              resolve(params);
            });
        })
        .catch((err) => {
          console.error(err);
          resolve(params);
        });
    });
  }
}
