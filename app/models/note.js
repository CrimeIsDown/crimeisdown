import Model, { belongsTo, attr } from '@ember-data/model';

export default Model.extend({
  incident: belongsTo('incident', {async: true, inverse: null}),
  createdAt: attr('date', {
    defaultValue() { return new Date(); }
  }),
  author: attr('string'),
  body: attr('string')
});
