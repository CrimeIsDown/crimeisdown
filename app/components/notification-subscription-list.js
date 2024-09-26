import { set, action } from '@ember/object';
import { service } from '@ember/service';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class NotificationSubscriptionListComponent extends Component {
  @service store;

  @tracked
  subscriptions = [];

  @tracked
  availableTalkgroups = [];

  @action
  async initData() {
    if (!this.availableTalkgroups.length) {
      set(
        this,
        'availableTalkgroups',
        await this.store.peekAll('search-talkgroup'),
      );
    }

    const subscriptions = await this.store.findAll('transcript-subscription');
    set(this, 'subscriptions', subscriptions);
  }

  @action
  async deleteSubscription(subscription) {
    if (!confirm('Are you sure you want to delete this subscription?')) {
      return;
    }
    await subscription.destroyRecord();
    await this.initData();
  }
}
