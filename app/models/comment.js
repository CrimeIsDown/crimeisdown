import DS from 'ember-data';
const { attr, belongsTo } = DS;

export default DS.Model.extend({
  author: attr('string'),
  body: attr('string'),
  incidentId: belongsTo('incident')
});
