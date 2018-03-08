import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { get } from '@ember/object';
import FindQuery from 'ember-emberfire-find-query/mixins/find-query';
import $ from 'jquery';

export default Component.extend(FindQuery, {
  store: service(),
  init() {
    this._super(...arguments);
    // components share the same properties across instances
    if (this.incident) {
      this.location = this.incident.get('location');
      this.units = this.incident.get('units');
    } else {
      this.incident = this.get('store').createRecord('incident');
      // @TODO: Make Active the default status
      this.location = {address: '', description: ''};
      this.note = {author: 'Original dispatcher', content: ''};
      this.units = [];
    }
    fetch('https://cors-anywhere.herokuapp.com/https://script.google.com/macros/s/AKfycbwdMu3lgUaMPqA-ESlmhD12Yo6Jz78LlCM8cMQXW7Cm4O94sAA/exec?id=1kiv-ELXw9Z-LcfZ87dFlBDN4GMdjZv_Iz5DSxTH_Cd4&sheet=Radio%20IDs')
      .then((response) => {
        response.json().then((data) => {
          this.radioIds = data['Radio IDs'];
        })
      })
      .catch(() => {
        this.radioIds = {};
        alert('Could not fetch radio ID list');
      });
    this.model.units = [];
    this.model.agencies.forEach((agency) => {
      let units = [];
      // we must use get and pushObject in order to properly execute the computed functions and update state in the components
      get(agency, 'units').forEach((unit) => {
        units.pushObject(unit);
      });
      this.model.units.pushObject({
        groupName: get(agency, 'name'),
        options: units
      });
    });
  },
  actions: {
    searchUnit(unit) {
      // use https://github.com/fent/randexp.js to generate units
      // on comma:
      // 1. do radio id search
      // 2. if result, get agency, get text
      // 3. if unit already exists, use it, if not then make a new unit
      let unitResult = {searchResult: true, radioId: unit.trim(), agency: '', level1: '', level2: '', level3: '', level4: ''};

      let matches = [];
      this.radioIds.forEach((row) => {
        if (unitResult.radioId.match('^' + row.ID_Number + '$')) {
          matches.push(row);
        }
      });
      if (matches.length > 0) {
        matches.forEach((match) => {
          if (match.Agency.length) {
            unitResult.agency = match.Agency;
          }
          if (match.Level_1.length) {
            unitResult.level1 = match.Level_1;
          }
          if (match.Level_2.length) {
            unitResult.level2 = match.Level_2;
          }
          if (match.Level_3.length) {
            unitResult.level3 = match.Level_3;
          }
          if (match.Level_4.length) {
            if (match.Level_4 === 'Beat Car') {
              unitResult.level4 = 'Beat #' + unitResult.radioId.match(/\d+/)[0];
            } else {
              unitResult.level4 = match.Level_4;
            }
          }
        });
        return [unitResult];
      }
      return [];
    },
    setUnits(units) {
      // @TODO: possible bug - if items are removed we do not do removeObject
      units.forEach((v) => {
        // only do this for new results from search
        if (v.searchResult) {
          this.filterEqual(this.get('store'), 'agency', {slug: v.agency.toLowerCase()}, (agencies) => {
            let agency = agencies.get('firstObject');
            if (agency) {
              this.filterEqual(this.get('store'), 'unit', {radioId: v.radioId}, (units) => {
                let first = units.get('firstObject');
                if (first) {
                  this.get('incident.units').pushObject(first);
                } else {
                  let record = this.get('store').createRecord('unit', {
                    agency: agency,
                    radioId: v.radioId
                  });
                  record.save().then(() => {
                    this.get('incident.units').pushObject(record);
                  });
                }
              });
            }
          });
        }
      });
    },
    create() {
      let incident = this.get('incident');
      let note = this.get('store').createRecord('note', this.get('note'));
      incident.get('notes').pushObject(note);
      let location = this.get('store').createRecord('location', this.get('location'));
      incident.set('location', location);
      location.save()
        .then(() => {
          note.save()
            .then(() => {
              incident.save()
                .then(() => {
                  $('#add-incident-modal').modal('hide');
                })
                .catch((e) => {
                  console.error(e.errors)
                });
            })
            .catch((e) => {
              console.error(e.errors)
            });
        })
        .catch((e) => {
          console.error(e.errors)
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
      // @TODO: delete related models
      this.get('incident').destroyRecord().then(() => {
        this.get('openIncidents').removeObject(this.get('incident'));
        $('#cadTabs #map-tab').tab('show');
      });
    },
  }
});
