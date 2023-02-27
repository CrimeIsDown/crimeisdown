import RESTAdapter from '@ember-data/adapter/rest';
import { service } from '@ember/service';

export default class ApplicationAdapter extends RESTAdapter {
  @service config;

  namespace = 'api';

  get host() {
    return this.config.get('API_BASE_URL');
  }

  get headers() {
    return {
      Accept: 'application/json',
      'X-XSRF-TOKEN': decodeURIComponent(
        document.cookie
          .split('; ')
          .find((row) => row.startsWith('XSRF-TOKEN='))
          ?.split('=')[1]
      ),
    };
  }

  ajaxOptions() {
    const options = super.ajaxOptions(...arguments);
    options.credentials = 'include';
    return options;
  }
}
