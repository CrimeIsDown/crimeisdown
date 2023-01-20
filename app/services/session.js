import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class SessionService extends Service {
  @tracked isAuthenticated = false;

  @tracked user = undefined;

  constructor() {
    super(...arguments);

    this.getUser();
  }

  async getUser() {
    try {
      const response = await fetch('https://api.crimeisdown.com/api/user', {
        credentials: 'include',
      });
      this.user = await response.json();
      this.isAuthenticated = true;
    } catch (e) {
      this.isAuthenticated = false;
    }
  }
}
