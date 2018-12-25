import Component from '@ember/component';
import { set } from '@ember/object';
import $ from 'jquery';
import fetch from 'fetch';

export default Component.extend({
  init() {
    this._super(...arguments);
    this.radioIds = [];
    this.radio = {};
  },
  didInsertElement() {
    fetch('https://cors-anywhere.herokuapp.com/https://script.google.com/macros/s/AKfycbwdMu3lgUaMPqA-ESlmhD12Yo6Jz78LlCM8cMQXW7Cm4O94sAA/exec?id=1kiv-ELXw9Z-LcfZ87dFlBDN4GMdjZv_Iz5DSxTH_Cd4&sheet=Radio%20IDs')
      .then((response) => {
        response.json().then((data) => {
          this.radioIds = data['Radio IDs'];
        })
      })
      .catch(() => {
        this.radioIds = {};
        alert('Could not fetch radio ID list');
      });
  },
  actions: {
    lookupRadioId() {
      let input = this.radioId;
      if (window.ga && typeof window.ga === "function") {
        ga('send', 'event', 'Searches radio ID list', 'Tools', input);
      }
      let matches = [];
      this.radioIds.forEach((row) => {
        if (input.match('^' + row.ID_Number + '$')) {
          matches.push(row);
        }
      });
      $('#radioid-results td').empty();
      if (matches.length > 0) {
        set(this, 'radio', {agency: '', level1: '', level2: '', level3: '', level4: ''});
        matches.forEach((match) => {
          if (match.Agency.length) {
            this.radio.agency = match.Agency;
          }
          if (match.Level_1.length) {
            this.radio.level1 = match.Level_1;
          }
          if (match.Level_2.length) {
            this.radio.level2 = match.Level_2;
          }
          if (match.Level_3.length) {
            this.radio.level3 = match.Level_3;
          }
          if (match.Level_4.length) {
            if (match.Level_4 === 'Beat Car') {
              this.radio.level4 = 'Beat #' + input.match(/\d+/)[0];
            } else {
              this.radio.level4 = match.Level_4;
            }
          }
        });
      } else {
        set(this, 'radio', {agency: 'N/A', level1: 'N/A', level2: 'N/A', level3: 'N/A', level4: 'N/A'});
      }
    }
  }
});







