import Component from '@ember/component';
import { inject as service } from '@ember/service';
import $ from 'jquery';

export default Component.extend({
  store: service(),
  init() {
    this._super(...arguments);
  },
  actions: {
    update() {
      this.get('incident').save().then(() => {
        $('#update-incident-modal').modal('hide');
      });
    }
  }
});
