import DS from 'ember-data';
const { attr, belongsTo } = DS;

export default DS.Model.extend({
  agency: belongsTo('agency'),
  radioId: attr('string')
});
