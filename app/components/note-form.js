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
      let note = this.store.createRecord('note', this.note);
      this.get('incident.notes').pushObject(note);
      note.save().then(() => {
        this.incident.save().then(() => {
          this.set('showForm', false);
        });
      });
    },
    update() {
      this.note.save().then(() => {
        this.set('showForm', false);
      });
    },
    delete() {
      this.get('incident.notes').removeObject(this.note);
      this.incident.save();
    }
  }
});
