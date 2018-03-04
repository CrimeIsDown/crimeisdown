import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { get } from '@ember/object';
import $ from 'jquery';

export default Component.extend({
  store: service(),
  init() {
    this._super(...arguments);
    // components share the same properties across instances
    if (!this.incident) {
      this.incident = {};
    }
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
    this.priorities = [{
      level: 0,
      description: "Emergency Assistance"
    }, {
      level: 1,
      description: "Immediate Dispatch - life threatening"
    }, {
      level: 2,
      description: "Rapid Dispatch"
    }, {
      level: 3,
      description: "Routine Dispatch"
    }, {
      level: 4,
      description: "Administrative Dispatch"
    }, {
      level: 5,
      description: "Alternate Response"
    }];
    if (get(this.incident, 'priority')) {
      this.priority = this.priorities[get(this.incident, 'priority')];
    }
  },
  actions: {
    setPriority(priority) {
      this.set('incident.priority', priority.level);
      this.set('priority', priority);
    },
    create() {
      this.get('store').createRecord('incident', this.get('incident')).save().then(() => {
        $('#add-incident-modal').modal('hide');
      });
    },
    update() {
      this.get('incident').save().then(() => {
        $('#update-incident-modal').modal('hide');
        alert('Updated successfully!');
      });
    },
    close() {
      this.get('openIncidents').removeObject(this.get('incident'));
      $('#cadTabs #map-tab').tab('show');
    },
    delete() {
      this.get('incident').destroyRecord().then(() => {
        this.get('openIncidents').removeObject(this.get('incident'));
        $('#cadTabs #map-tab').tab('show');
      });
    },
  }
});
