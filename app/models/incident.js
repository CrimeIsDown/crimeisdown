import DS from 'ember-data';
const { attr, hasMany, belongsTo } = DS;

export default DS.Model.extend({
  createdAt: attr('date', {
    defaultValue() { return new Date(); }
  }),
  updatedAt: attr('date', {
    defaultValue() { return new Date(); }
  }),
  // nature of the call (e.g. car vs semi crash and rollover)
  callNature: attr('string'),
  // type of call (e.g. MVA w/ entrapment)
  callType: belongsTo('call-type'),
  // longer description of the call
  narrative: attr('string'),
  // address of incident (intersection, full address, etc.)
  address: attr('string'),
  // location object from address lookup tool)
  location: attr('location'),
  // priority level (e.g. 1)
  // see http://directives.chicagopolice.org/directives/data/a7a57be2-128ff3f0-ae912-8ff7-442a6e5fde43e2df.html
  priority: attr('number'),
  // disposition of call, aka how it ended (e.g. 19-Paul)
  disposition: attr('string'),
  // units attached to the call
  units: hasMany('unit'),
  // relevant tweets
  tweets: hasMany('tweet'),
  // relevant photos
  photos: hasMany('photo'),
  // further updates
  comments: hasMany('comment')
});
