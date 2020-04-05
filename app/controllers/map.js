import Controller from '@ember/controller';
import { action } from '@ember/object';
import ENV from '../config/environment';

export default class Map extends Controller {
  showTabs = ENV.APP.INCIDENT_CAD_ENABLED;
  openIncidents = [];

  @action
  closeTab(incident) {
    this.openIncidents.removeObject(incident);
    window.$('#cadTabs #map-tab').tab('show');
  }
}
