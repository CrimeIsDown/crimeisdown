import DS from 'ember-data';
import ESASession from 'ember-simple-auth/services/session';
import { inject as service } from '@ember/service';
import { computed } from '@ember/object';

export default ESASession.extend({

  store: service(),

  currentUser: computed('isAuthenticated', () => {
    if (this.isAuthenticated) {
      return DS.PromiseObject.create({
        promise: this.store.queryRecord('user', {})
      });
    }
  })

});
