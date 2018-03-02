import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { get } from '@ember/object';

export default Component.extend({
  store: service(),
  init() {
    this._super(...arguments);
    this.incident = {};
    this.units = [];
    this.agencies.forEach((agency) => {
      let units = [];
      // we must use get and pushObject in order to properly execute the computed functions and update state in the components
      get(agency, 'units').forEach((unit) => {
        units.pushObject(unit);
      });
      this.units.pushObject({
        groupName: get(agency, 'name'),
        options: units
      });
    });
  },
  actions: {
    deleteIncident(incident) {
      incident.destroyRecord();
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
