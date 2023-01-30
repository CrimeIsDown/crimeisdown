import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import config from 'crimeisdown/config/environment';

export default class ConfigService extends Service {
  @tracked ENV;

  constructor() {
    super(...arguments);

    const ENV = { ...config.APP };
    // Delete the default envs from Ember
    delete ENV['name'];
    delete ENV['version'];

    try {
      for (const key in ENV) {
        const value = localStorage.getItem(key);
        if (value) {
          ENV[key] = value;
        }
      }
    } catch {
      // Do nothing, we don't have localStorage
    }

    this.ENV = ENV;
  }

  get(key) {
    return this.ENV[key];
  }

  set(key, value) {
    if (this.ENV[key] != value) {
      this.ENV[key] = value;
      try {
        if (value) {
          localStorage.setItem(key, value);
        } else {
          localStorage.removeItem(key);
        }
      } catch {
        // Do nothing, we don't have localStorage
      }
    }
  }
}
