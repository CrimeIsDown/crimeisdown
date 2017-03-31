import Ember from 'ember';

export default Ember.Component.extend({
  ucrCodes: [],
  ucr: {},
  didInsertElement() {
    Ember.$.getJSON('https://cors-anywhere.herokuapp.com/https://script.google.com/macros/s/AKfycbwdMu3lgUaMPqA-ESlmhD12Yo6Jz78LlCM8cMQXW7Cm4O94sAA/exec?id=1Zzx6UXOYL5BXXYTO_PanTESGS5nHLHDMxBi7u0k1ppg&sheet=UCR%20Codes')
      .done((data) => {
        this.ucrCodes = data['UCR Codes'];
      })
      .fail(() => {
        this.ucrCodes = {};
        alert('Could not fetch UCR code list');
      });
  },
  actions: {
    lookupUCR() {
      let input = this.get('ucrCode');
      if (window.ga && typeof window.ga === "function") {
        ga('send', 'event', 'Searches UCR list', 'Tools', input);
      }
      Ember.set(this, 'ucr', {primaryDesc: 'Not Found', secondaryDesc: 'Not Found', indexCode: 'N/A'});
      let code = transformUCR(input);
      this.ucrCodes.forEach((row) => {
        if (code === transformUCR(row.ucrCode)) {
          Ember.set(this, 'ucr', row);
          Ember.set(this, 'ucrCode', code);
          return;
        }
      });
      function transformUCR(code) {
        return code.toUpperCase().replace(/-/g, '');
      }
    }
  }
});


