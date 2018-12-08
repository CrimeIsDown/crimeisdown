import Route from '@ember/routing/route';
import RSVP from 'rsvp';

export default Route.extend({
  model() {
    return RSVP.hash({
      agencies: this.store.findAll('agency'),
      incidents: this.store.findAll('incident'),
      incidentDispositions: this.store.findAll('incident-disposition'),
      incidentPriorities: this.store.findAll('incident-priority'),
      incidentStatuses: this.store.findAll('incident-status'),
      incidentTypes: this.store.findAll('incident-type')
    });
  }
});
