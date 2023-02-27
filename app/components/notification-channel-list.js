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
    this.store.findAll('notification-channel').then((channels) => {
      this.channels = channels;
    });
  }

  @action
  async deleteChannel(channel) {
    await channel.destroyRecord();
    set(this, 'channels', await this.store.findAll('notification-channel'));
  }
}
