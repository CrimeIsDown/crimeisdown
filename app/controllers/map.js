import Controller from '@ember/controller';

export default Controller.extend({
  init() {
    this._super(...arguments);
    this.openIncidents = [];
  },
  actions: {
    closeTab(incident) {
      this.get('openIncidents').removeObject(incident);
    }
  }
});
