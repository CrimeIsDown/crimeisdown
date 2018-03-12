import DS from 'ember-data';

export default DS.Transform.extend({
  deserialize(serialized) {
    return L.geoJSON(serialized);
  },

  serialize(deserialized) {
    if (Array.isArray(deserialized)) {
      return deserialized.map(v => v.toGeoJSON());
    }
    return deserialized.toGeoJSON();
  }
});
