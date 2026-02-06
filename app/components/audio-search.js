import Component from '@glimmer/component';
import { service } from '@ember/service';
import { action } from '@ember/object';
import moment from 'moment-timezone';
import { encryptedZones, feeds } from 'crimeisdown/utils/audio-feed-config';

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

    this.encryptedZones = encryptedZones;
    this.feeds = feeds;
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
      'America/Chicago',
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
