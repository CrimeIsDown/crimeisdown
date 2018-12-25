import Component from '@ember/component';
import fetch from 'fetch';

export default Component.extend({
  init() {
    this._super(...arguments);
    this.ucrCodes = [];
    this.ucr = {};
  },
  didInsertElement() {
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
  },
  actions: {
    lookupUCR() {
      let input = this.ucrCode;
      if (window.ga && typeof window.ga === "function") {
        ga('send', 'event', 'Searches UCR list', 'Tools', input);
      }
      this.set('ucr', {primaryDesc: 'Not Found', secondaryDesc: 'Not Found', indexCode: 'N/A'});
      let code = transformUCR(input);
      this.ucrCodes.forEach((row) => {
        if (code === transformUCR(row.ucrCode)) {
          this.set('ucr', row);
          this.set('ucrCode', code);
          return;
        }
      });
      function transformUCR(code) {
        return code.toUpperCase().replace(/-/g, '');
      }
    }
  }
});


