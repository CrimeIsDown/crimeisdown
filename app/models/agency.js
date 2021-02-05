import Model, { hasMany, attr } from '@ember-data/model';

export default Model.extend({
  slug: attr('string'),
  name: attr('string'),
  units: hasMany('unit', {async: true, inverse: null})
});
