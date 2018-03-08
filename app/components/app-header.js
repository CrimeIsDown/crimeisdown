import LinkComponent from '@ember/routing/link-component';
import Component from '@ember/component';
import { inject as service } from '@ember/service';

LinkComponent.reopen({
  attributeBindings: ['data-toggle', 'data-target']
});

export default Component.extend({
  session: service('session'),

  actions: {
    logout: function() {
      this.get('session').invalidate().then(function() {
        this.transitionToRoute('login');
      }.bind(this));
    }
  }
});
