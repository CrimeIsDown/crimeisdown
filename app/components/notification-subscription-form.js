import { action, set } from '@ember/object';
import { service } from '@ember/service';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class NotificationSubscriptionFormComponent extends Component {
  @service config;
  @service session;
  @service store;

  @tracked
  availableTalkgroups = [];

  @tracked
  channels = [];

  @action
  async initData() {
    this.getTalkgroups();
    this.getChannels();
  }

  @action
  async getChannels() {
    set(this, 'channels', await this.store.findAll('notification-channel'));
  }

  @action
  async getTalkgroups() {
    set(
      this,
      'availableTalkgroups',
      await this.store.findAll('search-talkgroup')
    );
  }

  @action
  async submit(event) {
    event.preventDefault();
    const formdata = new FormData(event.target);
    if (!formdata.getAll('topic').length) {
      alert('You must select at least one talkgroup to match.');
      return;
    }
    if (!formdata.getAll('notification_channels').length) {
      alert('You must select at least one notification channel.');
      return;
    }
    const data = {
      name: formdata.get('name'),
      keywords: formdata.get('keywords').split('\n'),
      topic: formdata.getAll('topic').join('|'),
      notification_channels: formdata
        .getAll('notification_channels')
        .map((value) => parseInt(value)),
    };
    if (this.args.subscription) {
      const subscription = this.args.subscription;
      Object.assign(subscription, data);
      subscription.save();
    } else {
      const subscription = this.store.createRecord(
        'transcript-subscription',
        data
      );
      subscription.save();
      document.getElementById('subscription-form').reset();
    }

    this.args.onSubmit();
  }
}
