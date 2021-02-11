import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action, set } from '@ember/object';
import fetch from 'fetch';

export default class SearchUcrcodes extends Component {
  @tracked ucrCodes = [];
  @tracked ucr = {};

  constructor() {
    super(...arguments);

    fetch('/data/city_data/ucr_codes.json')
      .then((response) => {
        response.json().then((data) => {
          this.ucrCodes = data;
        });
      })
      .catch(() => {
        this.ucrCodes = {};
        alert('Could not fetch UCR code list');
      });
  }

  @action
  lookupUCR(event) {
    event.preventDefault();
    let input = this.ucrCode;
    if (!input) {
      alert('Please enter a UCR code before searching.');
      return;
    }
    if (window.ga && typeof window.ga === 'function') {
      ga('send', 'event', 'Searches UCR list', 'Tools', input);
    }
    set(this, 'ucr', {
      primaryDesc: 'Not Found',
      secondaryDesc: 'Not Found',
      indexCode: 'N/A',
    });
    let code = transformUCR(input);
    this.ucrCodes.forEach((row) => {
      if (code === transformUCR(row.ucrCode)) {
        set(this, 'ucr', row);
        set(this, 'ucrCode', code);
        return;
      }
    });
    function transformUCR(code) {
      return code.toUpperCase().replace(/-/g, '');
    }
  }
}
