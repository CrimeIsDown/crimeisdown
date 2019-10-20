import Controller from '@ember/controller';

export default Controller.extend({
  init() {
    this._super(...arguments);
    // @TODO: Sync openIncidents to localStorage
    this.openIncidents = [];
  },
  actions: {
    closeTab(incident) {
      this.openIncidents.removeObject(incident);
      window.$('#cadTabs #map-tab').tab('show');
    }
  }
});
