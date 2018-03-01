import DS from 'ember-data';
const { attr, belongsTo } = DS;

export default DS.Model.extend({
  url: attr('string'),
  incidentId: belongsTo('incident')
});
