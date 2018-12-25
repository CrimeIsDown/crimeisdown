import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default Controller.extend({
  session: service('session'),

  actions: {
    login: function() {
      this.session.authenticate('authenticator:firebase', {
        'email': this.email,
        'password': this.password
      }).then(function() {
        this.transitionToRoute('index');
      }.bind(this));
    }
  }
});
