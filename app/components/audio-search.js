import Ember from 'ember';

export default Ember.Component.extend({
  didRender() {
    let options = {
      min: new Date('2016-12-11T08:00:00.000Z'),
      max: new Date(),
      inputFormat: 'M/D/YYYY h:mm a',
      dayFormat: 'D',
      timeFormat: 'h:mm a',
      timeInterval: 3600
    };
    options.max.setHours(options.max.getHours()-1);
    options.max.setMinutes(59);
    options.initialValue = options.max;
    options.initialValue.setMinutes(0);
    rome(document.querySelector('#datetimepicker'), options);
  }
});
