import Component from '@ember/component';
import { inject as service } from '@ember/service';

export default Component.extend({
  store: service(),
  showForm: false,
  init() {
    this._super(...arguments);
    this.comment = {};
  },
  actions: {
    create() {
      this.set('comment.incident', this.get('incident'));
      this.get('store').createRecord('comment', this.get('comment')).save();
      this.set('showForm', false);
    }
  }
});
