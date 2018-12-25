import DS from 'ember-data';
const { attr, hasMany } = DS;

export default DS.Model.extend({
  incidents: hasMany('incident', {async: true, inverse: null}),
  value: attr('string'),
  description: attr('string')
});
