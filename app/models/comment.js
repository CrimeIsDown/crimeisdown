import DS from 'ember-data';
const { attr, belongsTo } = DS;

export default DS.Model.extend({
  incident: belongsTo('incident'),
  createdAt: attr('date', {
    defaultValue() { return new Date(); }
  }),
  author: attr('string'),
  body: attr('string')
});
