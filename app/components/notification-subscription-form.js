import { action, set } from '@ember/object';
import { service } from '@ember/service';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class NotificationSubscriptionFormComponent extends Component {
  @service config;
  @service session;
  @service store;

  @tracked
  availableTalkgroups = [];

  @tracked
  channels = [];

  @action
  async initData() {
    this.getTalkgroups();
    this.getChannels();
  }

  @action
  async getChannels() {
    set(this, 'channels', await this.store.findAll('notification-channel'));
  }

  @action
  async getTalkgroups() {
    set(
      this,
      'availableTalkgroups',
      await this.store.findAll('search-talkgroup'),
    );
  }

  @action
  async loadAutocomplete() {
    if (this.session.user.patreon_tier.features.transcript_geosearch) {
      const center = { lat: 41.8781, lng: -87.6298 }; // downtown Chicago
      const defaultBounds = {
        north: center.lat + 1,
        south: center.lat - 1,
        east: center.lng + 1,
        west: center.lng - 1,
      };
      const input = document.getElementById('addressInput');
      const options = {
        bounds: defaultBounds,
        componentRestrictions: { country: 'us' },
        fields: ['address_components', 'geometry', 'icon', 'name'],
        strictBounds: false,
      };
      const autocomplete = new google.maps.places.Autocomplete(input, options);
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry) {
          return;
        }
        document.getElementById('latInput').value =
          place.geometry.location.lat();
        document.getElementById('lngInput').value =
          place.geometry.location.lng();
        document.getElementById('mapAddressButton').href =
          `https://www.google.com/maps/search/?api=1&query=${place.geometry.location.lat()},${place.geometry.location.lng()}`;
      });
    }
  }

  @action
  async submit(event) {
    event.preventDefault();
    const formdata = new FormData(event.target);
    if (!formdata.getAll('topic').length) {
      alert('You must select at least one talkgroup to match.');
      return;
    }
    if (!formdata.getAll('notification_channels').length) {
      alert('You must select at least one notification channel.');
      return;
    }
    let isJustNtfy = true;
    for (const channel of formdata.getAll('notification_channels')) {
      if (
        (await this.store.peekRecord('notification-channel', channel)
          .service) != 'ntfy'
      ) {
        isJustNtfy = false;
        break;
      }
    }
    if (
      formdata.get('keywords').length == 0 &&
      !formdata.get('address') &&
      !isJustNtfy
    ) {
      alert('You must enter at least one keyword or address.');
      return;
    }
    if (
      formdata.get('address') &&
      (!formdata.get('lat') || !formdata.get('lng'))
    ) {
      alert('You must select a valid address from the autocomplete.');
      return;
    }
    if (
      formdata.get('address') &&
      !formdata.get('radius') &&
      !formdata.get('travel_time')
    ) {
      alert('You must enter a radius or travel time for the address.');
      return;
    }
    let data = {
      name: formdata.get('name'),
      keywords: formdata.get('keywords').split('\n'),
      ignore_keywords: formdata.get('ignore_keywords').split('\n'),
      topic: formdata.getAll('topic').join('|'),
      notification_channels: formdata
        .getAll('notification_channels')
        .map((value) => parseInt(value)),
    };
    const location = {
      address: formdata.get('address'),
      geo: {
        lat: parseFloat(formdata.get('lat')),
        lng: parseFloat(formdata.get('lng')),
      },
      radius: parseFloat(formdata.get('radius')),
      travel_time: parseFloat(formdata.get('travel_time')),
    };
    if (!isNaN(location.geo.lat) && !isNaN(location.geo.lng)) {
      data.location = location;
    }
    if (this.args.subscription) {
      const subscription = this.args.subscription;
      Object.assign(subscription, data);
      subscription.save();
    } else {
      const subscription = this.store.createRecord(
        'transcript-subscription',
        data,
      );
      subscription.save();
      document.getElementById('subscription-form').reset();
    }

    this.args.onSubmit();
  }
}
