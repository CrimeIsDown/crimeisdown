import Component from '@ember/component';
import { inject as service } from '@ember/service';
import $ from 'jquery';
import { bind } from '@ember/runloop';

export default Component.extend({
  store: service(),
  showNewForm: false,
  init() {
    this._super(...arguments);
  },
  actions: {
    openAddIncidentModal() {
      // only one incident form can be open at a time, so we must close all open incidents
      // and reopen them once the form has been un-rendered (after submission or cancel)
      let openIncidents = this.get('openIncidents');
      this.set('openIncidents', []);
      this.set('showNewForm', true);
      $('#add-incident-modal').modal('show');
      $('#add-incident-modal').on('hidden.bs.modal', bind(this, () => {
        this.set('showNewForm', false);
        this.set('openIncidents', openIncidents);
      }));
    },
    openIncident(incident) {
      this.get('openIncidents').pushObject(incident);
      let selector = '#cadTabs #incident-tab-'+incident.id;
      $(selector).ready(bind(this, () => {
        $(selector).tab('show');
      }));
    },
    seedData() {
      // populate agencies and units
      [{
        slug: 'cpd',
        name: 'Chicago Police Department',
        units: [{
          radioId: 'CPD 1000X'
        }, {
          radioId: 'CPD 1234'
        }]
      }, {
        slug: 'cfd',
        name: 'Chicago Fire Department',
        units: [{
          radioId: 'CFD E13'
        }]
      }, {
        slug: 'other',
        name: 'Other',
        units: [{
          radioId: 'Forest Park PD 1'
        }]
      }].forEach((v) => {
        let agency = this.get('store').createRecord('agency', {
          slug: v.slug,
          name: v.name
        });
        agency.save();
        v.units.forEach((unit) => {
          unit = this.get('store').createRecord('unit', unit);
          unit.save();
          unit.set('agency', agency);
        });
      });

      // populate call types
      [{
        slug: 'police-activity',
        name: 'Police Activity'
      }, {
        slug: 'fire-activity',
        name: 'Fire Activity'
      }, {
        slug: 'residential-fire',
        name: 'Residential Fire'
      }, {
        slug: 'garage-fire',
        name: 'Garage Fire'
      }, {
        slug: 'commercial-fire',
        name: 'Commercial Fire'
      }, {
        slug: 'multiple-alarm-fire',
        name: 'Multiple Alarm Fire'
      }, {
        slug: 'vehicular-hijacking',
        name: 'Vehicular Hijacking'
      }, {
        slug: 'armed-robbery',
        name: 'Armed Robbery'
      }, {
        slug: 'vehicle-crash',
        name: 'Vehicle Crash'
      }, {
        slug: 'vehicle-crash-pin-in',
        name: 'Vehicle Crash (pin-in)'
      }, {
        slug: 'person-battered-fight-in-progress',
        name: 'Person Battered / Fight in Progress'
      }, {
        slug: 'persons-shot',
        name: 'Person(s) Shot'
      }, {
        slug: 'persons-stabbed',
        name: 'Person(s) Stabbed'
      }, {
        slug: 'bomb-threat',
        name: 'Bomb Threat'
      }, {
        slug: 'gas-leak',
        name: 'Gas Leak'
      }, {
        slug: 'person-in-the-water',
        name: 'Person in the Water'
      }, {
        slug: 'animal-attack',
        name: 'Animal Attack'
      }, {
        slug: 'police-officer-needs-assistance',
        name: 'Police Officer Needs Assistance'
      }, {
        slug: 'missing-person',
        name: 'Missing Person'
      }, {
        slug: 'death-investigation',
        name: 'Death Investigation'
      }].forEach((v) => {
        this.get('store').createRecord('call-type', v).save();
      });
    }
  }
});
