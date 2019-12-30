import Route from '@ember/routing/route';
import fetch from 'fetch';

export default Route.extend({
  model(params) {
    return new Promise(resolve => {
      fetch('/data/audio_data/online_streams.json').then(response => {
        response.json().then(onlineStreams => {
          resolve(onlineStreams.filter(stream => stream.slug === params.stream)[0]);
        }).catch(err => {
          console.error(err);
          resolve(params);
        });
      }).catch(err => {
        console.error(err);
        resolve(params);
      });
    });
  }
});
