import Route from '@ember/routing/route';

export default Route.extend({
  model(params) {
    return {
      url: 'https://storage.googleapis.com/crimeisdown-audio-temp/' + params.filename,
      filename: params.filename
    };
  }
});
