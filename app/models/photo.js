import DS from 'ember-data';
const { attr, belongsTo } = DS;

export default DS.Model.extend({
  incident: belongsTo('incident'),
  author: attr('string'),
  caption: attr('string'),
  url: attr('string'),
});
