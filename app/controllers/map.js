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
      this.get('openIncidents').removeObject(incident);
      $('#cadTabs #map-tab').tab('show');
    }
  }
});
