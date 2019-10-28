import Route from '@ember/routing/route';

export default Route.extend({
  queryParams: {
    url: false,
    type: false
  },
  model(params) {
    if (!params.url) {
      alert('ERROR: No URL param specified.');
      return;
    }
    let filename = (new URL(params.url)).pathname.split('/').pop();
    let type;

    if (params.type) {
      type = params.type;
    } else {
      type = 'audio/' + filename.split('.').pop(); // use file extension
    }
    return {
      url: params.url,
      filename: filename,
      type: type
    };
  }
});
