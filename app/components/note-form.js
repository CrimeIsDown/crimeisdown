import Component from '@ember/component';
import { inject as service } from '@ember/service';

export default Component.extend({
  store: service(),
  showForm: false,
  init() {
    this._super(...arguments);
    if (!this.note) {
      this.note = {};
    }
  },
  actions: {
    create() {
      let note = this.get('store').createRecord('note', this.get('note'));
      this.get('incident.notes').pushObject(note);
      note.save().then(() => {
        this.get('incident').save().then(() => {
          this.set('showForm', false);
        });
      });
    },
    update() {
      this.get('note').save().then(() => {
        this.set('showForm', false);
      });
    },
    delete() {
      this.get('incident.notes').removeObject(this.get('note'));
      this.get('incident').save();
    }
  }
});
