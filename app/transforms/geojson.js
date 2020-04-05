import Transform from '@ember-data/serializer/transform';

export default Transform.extend({
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
