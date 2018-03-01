import DS from 'ember-data';
const { attr, hasMany } = DS;

export default DS.Model.extend({
  submitterName: attr('string'),
  callType: attr('string'),
  address: attr('string'),
  location: attr('location'),
  agencies: hasMany('agency'),
  description: attr('string'),
  tweets: hasMany('tweet'),
  photos: hasMany('photo'),
  comments: hasMany('comment')
});
