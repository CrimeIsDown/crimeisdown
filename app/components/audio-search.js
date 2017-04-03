import Ember from 'ember';

export default Ember.Component.extend({
  didInsertElement() {
    let options = {
      startDate: new Date("2016-12-11"),
      endDate: new Date(),
      showMeridian: true,
      format: "m/d/yyyy H:ii p"
    };
    options.endDate.setHours(options.endDate.getHours()-1);
    options.endDate.setMinutes(59);
    $('#datetimepicker').datetimepicker(options);
  }
});
