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
      let comment = this.get('store').createRecord('comment', this.get('comment'));
      this.get('incident.comments').pushObject(comment);
      comment.save().then(() => {
        this.get('incident').save();
      });
      this.set('showForm', false);
    }
  }
});
