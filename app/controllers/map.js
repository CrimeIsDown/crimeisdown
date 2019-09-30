import Controller from '@ember/controller';
import $ from 'jquery';

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
