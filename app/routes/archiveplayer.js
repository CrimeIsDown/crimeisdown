import Route from '@ember/routing/route';

export default Route.extend({
  queryParams: {
    url: false
  },
  model(params) {
    if (!params.url) {
      return {
        url: 'https://storage.googleapis.com/crimeisdown-audio-temp/' + params.filename,
        filename: params.filename
      };
    } else {
      let filename = (new URL(params.url)).pathname.split('/').pop();
      return {
        url: params.url,
        filename: filename
      };
    }
  }
});
