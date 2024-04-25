import { getOwner } from '@ember/application';
import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import * as Sentry from '@sentry/ember';

export default class SessionService extends Service {
  @tracked isAuthenticated = false;
  @tracked user = undefined;
  fetchOptions = {
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  };

  constructor() {
    super(...arguments);

    this.config = getOwner(this).lookup('service:config');

    const token = this.config.get('API_AUTH_TOKEN');
    if (token) {
      this.fetchOptions.headers['Authorization'] = `Bearer ${token}`;
    }

    this.authenticated = new Promise((resolve) => {
      this.getUser().then(() => {
        if (this.isAuthenticated) {
          Sentry.setUser({ email: this.user.email });
        }
        resolve(this.isAuthenticated);
      });
    });
  }

  async getUser() {
    try {
      const response = await fetch(
        this.config.get('API_BASE_URL') + '/api/user',
        this.fetchOptions,
      );
      if (response.status === 200) {
        this.user = await response.json();
        this.isAuthenticated = true;
      } else {
        throw new Error();
      }
    } catch (e) {
      this.isAuthenticated = false;
    }
    return this.user;
  }

  async getSearchAPIKey() {
    if (this.config.get('MEILISEARCH_KEY')) {
      return Promise.resolve(this.config.get('MEILISEARCH_KEY'));
    }
    if (this.isAuthenticated) {
      const response = await fetch(
        this.config.get('API_BASE_URL') + '/api/search-key',
        {
          headers: {
            Accept: 'text/plain',
          },
          credentials: 'include',
        },
      );
      if (response.status != 200) {
        return Promise.reject(response.status);
      }
      return await response.text();
    }
    return Promise.reject('Not logged in!');
  }
}
