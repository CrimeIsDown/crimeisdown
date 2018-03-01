import Component from '@ember/component';

export default Component.extend({
  init() {
    this._super(...arguments);

    this.incidents = this.get('store').findAll('incident');
  },
  actions: {
    addIncident(data) {
      console.log(data);
      this.get('store').createRecord('incident', data);
    },
    updateIncident(id, data) {
      this.get('store').findRecord('incident', id).then((incident) => {
        data.forEach((k, v) => {
          incident.set(k, v);
        });
      });
    },
    deleteIncident(id) {
      this.get('store').findRecord('incident', id, { backgroundReload: false }).then((incident) => {
        incident.destroyRecord();
      });
    },
    seedData() {
      // populate agencies
      this.get('store').push({
        data: [{
          id: 1,
          type: 'agency',
          attributes: {
            slug: 'cpd',
            name: 'Chicago Police Department'
          },
          relationships: {}
        }, {
          id: 2,
          type: 'agency',
          attributes: {
            slug: 'cfd',
            name: 'Chicago Fire Department'
          },
          relationships: {}
        }, {
          id: 3,
          type: 'agency',
          attributes: {
            slug: 'other',
            name: 'Other'
          },
          relationships: {}
        }]
      });

      // populate call types
      this.get('store').push({
        data: [{
          id: 1,
          type: 'call-type',
          attributes: {
            slug: 'police-activity',
            name: 'Police Activity'
          },
          relationships: {}
        }, {
          id: 2,
          type: 'call-type',
          attributes: {
            slug: 'fire-activity',
            name: 'Fire Activity'
          },
          relationships: {}
        }, {
          id: 3,
          type: 'call-type',
          attributes: {
            slug: 'residential-fire',
            name: 'Residential Fire'
          },
          relationships: {}
        }, {
          id: 4,
          type: 'call-type',
          attributes: {
            slug: 'garage-fire',
            name: 'Garage Fire'
          },
          relationships: {}
        }, {
          id: 5,
          type: 'call-type',
          attributes: {
            slug: 'commercial-fire',
            name: 'Commercial Fire'
          },
          relationships: {}
        }, {
          id: 6,
          type: 'call-type',
          attributes: {
            slug: 'multiple-alarm-fire',
            name: 'Multiple Alarm Fire'
          },
          relationships: {}
        }, {
          id: 7,
          type: 'call-type',
          attributes: {
            slug: 'vehicular-hijacking',
            name: 'Vehicular Hijacking'
          },
          relationships: {}
        }, {
          id: 8,
          type: 'call-type',
          attributes: {
            slug: 'armed-robbery',
            name: 'Armed Robbery'
          },
          relationships: {}
        }, {
          id: 9,
          type: 'call-type',
          attributes: {
            slug: 'vehicle-crash',
            name: 'Vehicle Crash'
          },
          relationships: {}
        }, {
          id: 10,
          type: 'call-type',
          attributes: {
            slug: 'vehicle-crash-pin-in',
            name: 'Vehicle Crash (pin-in)'
          },
          relationships: {}
        }, {
          id: 11,
          type: 'call-type',
          attributes: {
            slug: 'person-battered-fight-in-progress',
            name: 'Person Battered / Fight in Progress'
          },
          relationships: {}
        }, {
          id: 12,
          type: 'call-type',
          attributes: {
            slug: 'persons-shot',
            name: 'Person(s) Shot'
          },
          relationships: {}
        }, {
          id: 13,
          type: 'call-type',
          attributes: {
            slug: 'persons-stabbed',
            name: 'Person(s) Stabbed'
          },
          relationships: {}
        }, {
          id: 14,
          type: 'call-type',
          attributes: {
            slug: 'bomb-threat',
            name: 'Bomb Threat'
          },
          relationships: {}
        }, {
          id: 15,
          type: 'call-type',
          attributes: {
            slug: 'gas-leak',
            name: 'Gas Leak'
          },
          relationships: {}
        }, {
          id: 16,
          type: 'call-type',
          attributes: {
            slug: 'person-in-the-water',
            name: 'Person in the Water'
          },
          relationships: {}
        }, {
          id: 17,
          type: 'call-type',
          attributes: {
            slug: 'animal-attack',
            name: 'Animal Attack'
          },
          relationships: {}
        }, {
          id: 18,
          type: 'call-type',
          attributes: {
            slug: 'police-officer-needs-assistance',
            name: 'Police Officer Needs Assistance'
          },
          relationships: {}
        }, {
          id: 19,
          type: 'call-type',
          attributes: {
            slug: 'missing-person',
            name: 'Missing Person'
          },
          relationships: {}
        }, {
          id: 20,
          type: 'call-type',
          attributes: {
            slug: 'death-investigation',
            name: 'Death Investigation'
          },
          relationships: {}
        }]
      });
    }
  }
});
