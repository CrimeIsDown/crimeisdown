import Model, { hasMany, attr } from '@ember-data/model';

export default Model.extend({
  incidents: hasMany('incident', {async: true, inverse: null}),
  value: attr('string'),
  description: attr('string')
});
