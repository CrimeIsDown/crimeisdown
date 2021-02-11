import Component from '@glimmer/component';

export default class AudioSearch extends Component {
  constructor() {
    super(...arguments);
    let options = {
      enableTime: true,
      minDate: new Date('2016-12-11T08:00:00.000Z'),
      maxDate: new Date(),
      dateFormat: 'n/j/Y h:i K',
      minuteIncrement: 60,
    };
    options.maxDate.setHours(options.maxDate.getHours() - 1);
    options.maxDate.setMinutes(59);
    options.defaultDate = options.maxDate;
    options.defaultDate.setMinutes(0);
    this.options = options;
  }
}
