import Model, { belongsTo, hasMany, attr } from '@ember-data/model';

export default Model.extend({
  createdAt: attr('date', {
    defaultValue() { return new Date(); }
  }),
  updatedAt: attr('date', {
    defaultValue() { return new Date(); }
  }),
  // type of call (e.g. MVA w/ entrapment)
  type: belongsTo('incident-type', {async: true, inverse: null}),
  // summary of the nature of the call (e.g. car vs semi crash and rollover)
  nature: attr('string'),
  // location object from address lookup tool), incl. address of incident (intersection, full address, etc.)
  location: belongsTo('location', {async: true, inverse: null}),
  // priority level
  priority: belongsTo('incident-priority', {async: true, inverse: null}),
  // whether or not the incident is active
  status: belongsTo('incident-status', {async: true, inverse: null}),
  // disposition of call, aka how it ended
  disposition: belongsTo('incident-disposition', {async: true, inverse: null}),
  // units attached to the call
  units: hasMany('unit', {async: true, inverse: null}),
  // longer description of the call and further updates, formatting supported
  notes: hasMany('note', {async: true, inverse: null}),
});
