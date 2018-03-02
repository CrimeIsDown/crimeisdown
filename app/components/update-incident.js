import Component from '@ember/component';
import { inject as service } from '@ember/service';

export default Component.extend({
  store: service(),
  init() {
    this._super(...arguments);
  },
  actions: {
    update() {
      this.get('incident').save();
    }
  }
});
