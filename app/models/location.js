import Model, { attr } from '@ember-data/model';

export default Model.extend({
  // Latitude
  lat: attr('number'),
  // Longitude
  lng: attr('number'),
  // Incident location by value (XML must be in PIDF-LO format)
  address: attr('string'),
  // Further description about the incident's location
  description: attr('string'),
  // meta: attr('object'),
  // police: attr('object'),
  // fire: attr('object'),
  // ems: attr('object')

  // leaflet markers
  layer: attr('geojson')
});
