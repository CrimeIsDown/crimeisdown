import Route from '@ember/routing/route';
import { service } from '@ember/service';
import { hash } from 'rsvp';

export default class NotificationsRoute extends Route {
  @service store;

  model() {
    return hash({
      channels: this.store.findAll('notification-channel'),
      subscriptions: this.store.findAll('transcript-subscription'),
      talkgroups: this.store.findAll('search-talkgroup'),
    });
  }
}
