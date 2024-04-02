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

    this.feeds = [
      { value: 'citywide1', label: 'Citywide 1' },
      { value: 'citywide2', label: 'Citywide 2' },
      { value: 'citywide3', label: 'Citywide 3' },
      { value: 'citywide4', label: 'Citywide 4' },
      { value: 'citywide5', label: 'Citywide 5' },
      { value: 'citywide6', label: 'Citywide 6' },
      { value: 'citywide7', label: 'Citywide 7' },
      { value: 'zone1', label: 'Zone 1 (016/017)' },
      { value: 'zone2', label: 'Zone 2 (019)' },
      { value: 'zone3', label: 'Zone 3 (012/014)' },
      { value: 'zone4', label: 'Zone 4 (001/018)' },
      { value: 'zone5', label: 'Zone 5 (002) - no longer in use' },
      { value: 'zone6', label: 'Zone 6 (007/008)' },
      { value: 'zone7', label: 'Zone 7 (002/003)' },
      { value: 'zone8', label: 'Zone 8 (004/006)' },
      { value: 'zone9', label: 'Zone 9 (005/022)' },
      { value: 'zone10', label: 'Zone 10 (010/011)' },
      { value: 'zone11', label: 'Zone 11 (020/024)' },
      { value: 'zone12', label: 'Zone 12 (015/025)' },
      { value: 'zone13', label: 'Zone 13 (009)' },
      { value: 'fire_main', label: 'CFD Fire Main (North)' },
      { value: 'fire_englewood', label: 'CFD Fire Englewood (South)' },
      { value: 'ems_main', label: 'CFD EMS Main (North)' },
      { value: 'ems_englewood', label: 'CFD EMS Englewood (South)' },
    ];
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
