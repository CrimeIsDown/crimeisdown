import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default Controller.extend({
  session: service('session'),

  actions: {
    login: function() {
      this.get('session').authenticate('authenticator:firebase', {
        'email': this.get('email'),
        'password': this.get('password')
      }).then(function() {
        this.transitionToRoute('index');
      }.bind(this));
    }
  }
});
