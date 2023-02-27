import { action } from '@ember/object';
import { service } from '@ember/service';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class NotificationSettingsComponent extends Component {
  @service session;
  @service config;

  @tracked
  currentSubscription = undefined;

  @tracked
  currentChannel = undefined;

  @tracked
  notificationsConfig = undefined;

  @action
  editSubscription(subscription) {
    this.currentSubscription = subscription;
    this.scrollTo('subscription-form-heading');
  }

  @action
  clearCurrentSubscription() {
    this.currentSubscription = undefined;
  }

  @action
  async editChannel(channel) {
    this.currentChannel = channel;
    this.scrollTo('channel-form-heading');
  }

  @action
  clearCurrentChannel() {
    this.currentChannel = undefined;
  }

  @action
  async getNotificationsConfig() {
    const response = await fetch(
      this.config.get('API_BASE_URL') + '/api/config/notifications.json',
      this.session.fetchOptions
    );
    this.notificationsConfig = await response.json();
  }

  scrollTo(id) {
    const elem = document.getElementById(id);
    if (elem) {
      const y = elem.getBoundingClientRect().top + window.pageYOffset - 60;
      window.scrollTo({ top: y, behavior: 'smooth' });
    } else {
      console.error(`Could not find #${id}`);
    }
  }
}
