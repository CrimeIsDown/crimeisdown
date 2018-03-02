import DS from 'ember-data';
const { attr, hasMany, belongsTo } = DS;

export default DS.Model.extend({
  submitterName: attr('string'),
  title: attr('string'),
  callType: belongsTo('call-type'),
  address: attr('string'),
  location: attr('location'),
  description: attr('string'),
  units: hasMany('unit'),
  tweets: hasMany('tweet'),
  photos: hasMany('photo'),
  comments: hasMany('comment')
});
