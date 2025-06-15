import { action, set } from '@ember/object';
import { service } from '@ember/service';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import fetch from 'fetch';
import { SimpleSearchComponent } from 'react-frontend/src/search/simple-search.tsx';

export default class SearchUcrcodes extends Component {
  @service metrics;
  @tracked ucrCodes = [];
  @tracked ucr = {};

  simpleSearchComponent = SimpleSearchComponent;

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
  lookupUCR() {
    let input = this.ucrCode;
    this.metrics.trackEvent({
      category: 'Tools',
      action: 'Searches UCR list',
      label: input,
    });
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
