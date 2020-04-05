import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action, set } from '@ember/object';
import $ from 'jquery';
import fetch from 'fetch';

export default class SearchRadioids extends Component {
  @tracked
  radioId = null;

  radioIds = [];

  @tracked
  radio = {};

  constructor() {
    super(...arguments);

    fetch('/data/city_data/radio_ids.json')
      .then((response) => {
        response.json().then((data) => {
          this.radioIds = data;
        })
      })
      .catch(() => {
        this.radioIds = {};
        alert('Could not fetch radio ID list');
      });
  }

  @action
  lookupRadioId(event) {
    event.preventDefault();
    if (!this.radioId) {
      alert('Please enter a radio ID before searching.');
      return;
    }

    let input = this.radioId.toUpperCase();

    set(this, 'radioId', input);
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
          // If ends with $1, then replace with the numeric part of the query
          if (match.Level_4.match(/\$1$/)) {
            this.radio.level4 = match.Level_4.replace('$1', input.match(/\d+/)[0]);
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
