import DS from 'ember-data';
const { attr } = DS;

export default DS.Model.extend({
  slug: attr('string'),
  name: attr('string')
});
