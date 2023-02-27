import Model, { attr } from '@ember-data/model';

export default class NotificationChannelModel extends Model {
  @attr service;
  @attr path;

  get serviceName() {
    switch (this.service) {
      case 'tgram':
        return 'Telegram';
      case 'mailgun':
        return 'Email';
      case 'sns':
        return 'SMS';
      default:
        return this.service;
    }
  }

  get intId() {
    if (!this.id) {
      return null;
    }
    return parseInt(this.id);
  }
}
