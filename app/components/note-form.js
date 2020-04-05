import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class NoteForm extends Component {
  @service store;
  showForm = false;

  constructor() {
    super(...arguments);
    if (!this.note) {
      this.note = {};
    }
  }

  @action
  create() {
    let note = this.store.createRecord('note', this.note);
    this.incident.notes.pushObject(note);
    note.save().then(() => {
      this.incident.save().then(() => {
        this.showForm = false;
      });
    });
  }

  @action
  update() {
    this.note.save().then(() => {
      this.showForm = false;
    });
  }

  @action
  delete() {
    this.incident.notes.removeObject(this.note);
    this.incident.save();
  }
}
