import Component from '@ember/component';
import { inject as service } from '@ember/service';

export default Component.extend({
  store: service(),
  init() {
    this._super(...arguments);
    this.incident = {};
  },
  actions: {
    create() {
      this.get('store').createRecord('incident', this.get('incident')).save();
    }
  }
});
