import Component from '@ember/component';
import { inject as service } from '@ember/service';

export default Component.extend({
  store: service(),
  showForm: false,
  init() {
    this._super(...arguments);
    if (!this.comment) {
      this.comment = {};
    }
  },
  actions: {
    create() {
      let comment = this.get('store').createRecord('comment', this.get('comment'));
      this.get('incident.comments').pushObject(comment);
      comment.save().then(() => {
        this.get('incident').save().then(() => {
          this.set('showForm', false);
        });
      });
    },
    update() {
      this.get('comment').save().then(() => {
        this.set('showForm', false);
      });
    },
    delete() {
      this.get('incident.comments').removeObject(this.get('comment'));
      this.get('incident').save();
    }
  }
});
