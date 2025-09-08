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
    // Check if channels are already loaded in the store
    const existingChannels = this.store.peekAll('notification-channel');
    if (existingChannels.length > 0) {
      this.channels = existingChannels;
    } else {
      this.store.findAll('notification-channel').then((channels) => {
        this.channels = channels;
      });
    }
  }

  @action
  async deleteChannel(channel) {
    if (
      !confirm('Are you sure you want to delete this notification channel?')
    ) {
      return;
    }
    await channel.destroyRecord();
    // Use peekAll to get the updated channels from the store without making a new API call
    set(this, 'channels', this.store.peekAll('notification-channel'));
  }
}
