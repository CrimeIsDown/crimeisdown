import Component from '@ember/component';
import { inject as service } from '@ember/service';
import $ from 'jquery';

export default Component.extend({
  store: service(),
  init() {
    this._super(...arguments);
    this.incident = {};
  },
  actions: {
    create() {
      this.get('store').createRecord('incident', this.get('incident')).save().then(() => {
        $('#add-incident-modal').modal('hide');
      });
    }
  }
});
