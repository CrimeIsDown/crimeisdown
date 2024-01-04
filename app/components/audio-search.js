import Component from '@glimmer/component';
import { service } from '@ember/service';
import { action } from '@ember/object';
import moment from 'moment-timezone';

export default class AudioSearch extends Component {
  @service config;

  constructor() {
    super(...arguments);
    let options = {
      enableTime: true,
      minuteIncrement: 60,
      dateFormat: 'n/j/Y h:i K',
    };
    options.defaultDate = moment
      .tz('America/Chicago')
      .subtract(1, 'hours')
      .startOf('hour')
      .toDate();
    this.options = options;

    this.encryptedZones = {
      zone1: '2023-01-30 06:00:00',
      zone2: '2023-01-03 06:00:00',
      zone3: '2022-09-02 00:00:00',
      zone4: '2023-03-07 06:00:00',
      zone5: '2022-06-30 12:00:00',
      zone6: '2022-08-12 00:00:00',
      zone7: '2022-06-30 12:00:00',
      zone8: '2022-05-25 00:00:00',
      zone9: '2022-05-12 12:00:00',
      zone10: '2022-10-25 06:00:00',
      zone11: '2023-04-04 12:00:00',
      zone12: '2022-11-15 07:00:00',
      zone13: '2022-10-04 06:00:00',
    };
  }

  @action
  submit(event) {
    event.preventDefault();
    let downloadUrl =
      this.config.get('API_BASE_URL') + '/recordings/download-audio';
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
      inputs.broadcastify = 1;
    }
    inputs.datetime = datetime.utc().toISOString();
    const queryParams = new URLSearchParams(inputs);
    window.open(downloadUrl + '?' + queryParams.toString(), '_blank');
  }
}
