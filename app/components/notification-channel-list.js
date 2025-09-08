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
    this.loadChannels();
  }

  async loadChannels() {
    // Use findAll with backgroundReload: false to prevent duplicate requests
    // Ember Data will automatically deduplicate identical requests
    this.channels = await this.store.findAll('notification-channel', {
      backgroundReload: false,
      reload: false,
    });
  }

  @action
  async deleteChannel(channel) {
    if (
      !confirm('Are you sure you want to delete this notification channel?')
    ) {
      return;
    }
    await channel.destroyRecord();
    // Update the local array without making a new API call
    set(this, 'channels', this.store.peekAll('notification-channel'));
  }
}
