import { set, action } from '@ember/object';
import { service } from '@ember/service';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class NotificationChannelListComponent extends Component {
  @service store;

  @tracked
  channels = [];

  constructor() {
    super(...arguments);
    this.channels = this.store.peekAll('notification-channel');
  }

  @action
  async deleteChannel(channel) {
    if (
      !confirm('Are you sure you want to delete this notification channel?')
    ) {
      return;
    }
    await channel.destroyRecord();
    set(this, 'channels', await this.store.findAll('notification-channel'));
  }
}
