import Ember from 'ember';

let defaultGeoJSON = {
  type: 'FeatureCollection',
  features: []
};

export default Ember.Component.extend({
  lat: 41.8781,
  lng: -87.6298,
  zoom: 10,
  policeDistricts: defaultGeoJSON,
  didInsertElement() {
    Ember.$.getJSON("/map_data/police_districts.json").done((data) => {
      this.set('policeDistricts', data)
    });
  }
});
