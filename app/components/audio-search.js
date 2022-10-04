import Component from '@glimmer/component';
import { action } from '@ember/object';
import moment from 'moment-timezone';

export default class AudioSearch extends Component {
  constructor() {
    super(...arguments);
    let options = {
      enableTime: true,
      minDate: new Date('2016-12-11T08:00:00.000Z'),
      maxDate: new Date(),
      minuteIncrement: 60,
      dateFormat: 'n/j/Y h:i K',
    };
    options.maxDate.setHours(options.maxDate.getHours() - 1);
    options.maxDate.setMinutes(59);
    options.defaultDate = options.maxDate;
    options.defaultDate.setMinutes(0);
    this.options = options;

    this.encryptedZones = {
      zone3: '2022-09-02 00:00:00',
      zone5: '2022-06-30 12:00:00',
      zone6: '2022-08-12 00:00:00',
      zone7: '2022-06-30 12:00:00',
      zone8: '2022-05-25 00:00:00',
      zone9: '2022-05-12 12:00:00',
      zone11: '2022-10-03 12:00:00',
    };
  }

  @action
  submit(event) {
    event.preventDefault();
    let downloadUrl = 'https://audio.crimeisdown.com/download-audio.php';
    const inputs = {};
    for (const element of event.target.elements) {
      if (element.name) {
        inputs[element.name] = element.value;
      }
    }
    let datetime = moment.tz(
      inputs.datetime,
      'M/D/YYYY h:mm A',
      'America/Chicago'
    );
    if (
      Object.keys(this.encryptedZones).includes(inputs.feed) &&
      datetime.isAfter(this.encryptedZones[inputs.feed])
    ) {
      downloadUrl = 'https://audio.crimeisdown.com/download-bcfy-audio.php';
    }
    inputs.datetime = datetime.utc().toISOString();
    const queryParams = new URLSearchParams(inputs);
    window.open(downloadUrl + '?' + queryParams.toString(), '_blank');
  }
}
