import Route from '@ember/routing/route';
import RSVP from 'rsvp';

export default Route.extend({
  model() {
    return RSVP.hash({
      incidents: this.get('store').findAll('incident', {include: 'comments'}),
      callTypes: this.get('store').findAll('call-type'),
      agencies: this.get('store').findAll('agency', {include: 'units'})
    });
  }
});
