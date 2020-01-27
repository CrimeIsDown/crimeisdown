import Controller from '@ember/controller';
import ENV from '../config/environment';

export default Controller.extend({
  showTabs: ENV.APP.INCIDENT_CAD_ENABLED,
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
