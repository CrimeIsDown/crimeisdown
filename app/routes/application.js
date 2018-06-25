import Route from '@ember/routing/route';
import ApplicationRouteMixin from 'ember-simple-auth/mixins/application-route-mixin';
import { inject as service } from '@ember/service';
import { getOwner } from '@ember/application';

export default Route.extend(ApplicationRouteMixin, {
  session: service('session'),

  init() {
    if (!this.get('session').isAuthenticated) {
      getOwner(this).lookup('authenticator:firebase').get('firebase')
        .auth().signInAnonymously().catch(function(error) {
          console.error(error)
        });
    }
  }
});
