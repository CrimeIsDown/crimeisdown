import Component from '@ember/component';

export default Component.extend({
  actions: {
    deleteComment(incident, comment) {
      incident.get('comments').removeObject(comment);
      incident.save();
    }
  }
});
