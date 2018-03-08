import Route from '@ember/routing/route';
import RSVP from 'rsvp';

export default Route.extend({
  model() {
    return RSVP.hash({
      agencies: this.get('store').findAll('agency'),
      incidents: this.get('store').findAll('incident'),
      incidentDispositions: this.get('store').findAll('incident-disposition'),
      incidentPriorities: this.get('store').findAll('incident-priority'),
      incidentStatuses: this.get('store').findAll('incident-status'),
      incidentTypes: this.get('store').findAll('incident-type')
    });
  }
});
