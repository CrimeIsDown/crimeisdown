import { action } from '@ember/object';
import { service } from '@ember/service';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class NotificationChannelFormComponent extends Component {
  @service store;

  @tracked service;

  @action
  setService(event) {
    this.service = event.target.value;
  }

  @action
  async submit(event) {
    event.preventDefault();
    const formdata = new FormData(event.target);
    const data = {
      service: formdata.get('service'),
      path: formdata.get('path'),
    };
    if (this.args.channel) {
      const channel = this.args.channel;
      Object.assign(channel, data);
      channel.save();
    } else {
      const channel = this.store.createRecord('notification-channel', data);
      channel.save();
    }

    this.args.onSubmit();
  }
}
