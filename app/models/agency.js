import DS from 'ember-data';
const { attr, hasMany } = DS;

export default DS.Model.extend({
  slug: attr('string'),
  name: attr('string'),
  units: hasMany('unit', {async: true, inverse: null})
});
