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
      let openIncidents = this.openIncidents;
      this.set('openIncidents', []);
      this.set('showNewForm', true);
      window.$('#add-incident-modal').modal('show');
      $('#add-incident-modal').on('hidden.bs.modal', bind(this, () => {
        this.set('showNewForm', false);
        this.set('openIncidents', openIncidents);
      }));
    },
    openIncident(incident) {
      this.openIncidents.pushObject(incident);
      let selector = '#cadTabs #incident-tab-'+incident.id;
      $(selector).ready(bind(this, () => {
        $(selector).tab('show');
      }));
    },
    seedData() {
      // clear entire store
      (new Promise((resolve) => {
        this.store.unloadAll();
        resolve();
      })).then(() => {
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
          let agency = this.store.createRecord('agency', {
            slug: v.slug,
            name: v.name
          });
          agency.save();
          v.units.forEach((unit) => {
            unit = this.store.createRecord('unit', unit);
            unit.save();
            unit.set('agency', agency);
          });
        });

        // populate incident dispositions
        // read from XML http://technet.nena.org/nrs/registry/EIDD-CommonDispositionCode.xml?download
        [{
          value: '01',
          description: 'Report Taken'
        }].forEach((v) => {
          this.store.createRecord('incident-disposition', v).save();
        });

        // populate incident priorities
        // from http://directives.chicagopolice.org/directives/data/a7a57be2-128ff3f0-ae912-8ff7-442a6e5fde43e2df.html
        [{
          value: 0,
          description: "Emergency Assistance (10-1)"
        }, {
          value: 1,
          description: "Immediate Dispatch - life threatening"
        }, {
          value: 2,
          description: "Rapid Dispatch"
        }, {
          value: 3,
          description: "Routine Dispatch"
        }, {
          value: 4,
          description: "Administrative Dispatch"
        }, {
          value: 5,
          description: "Alternate Response"
        }].forEach((v) => {
          this.store.createRecord('incident-priority', v).save();
        });

        // populate incident statuses
        // read from XML http://technet.nena.org/nrs/registry/EIDD-IncidentStatus-Common.xml?download
        [{
          value: 'Active',
          description: 'The incident is active.'
        }].forEach((v) => {
          this.store.createRecord('incident-status', v).save();
        });

        // populate incident types
        // read from https://release.niem.gov/niem/codes/apco_event/4.0/apco_event.xsd - IncidentCategoryCodeSimpleType
        [{
          value: 'ABDOM',
          description: 'ABDOMINAL - Abdominal pain or problems'
        }].forEach((v) => {
          this.store.createRecord('incident-type', v).save();
        });
      });
    }
  }
});
