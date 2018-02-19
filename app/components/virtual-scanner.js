import Ember from 'ember';
import ENV from '../config/environment';
import fetch from 'fetch';
import dashjs from 'npm:dashjs';

export default Ember.Component.extend({
  streams: [],
  enabledStreams: [],
  init() {
    this._super(...arguments);
    fetch('https://audio.crimeisdown.com/streaming/stat')
      .then(response => response.text())
      .then(xml => (new window.DOMParser()).parseFromString(xml, 'text/xml'))
      .then(data => {
        let nodes = data.querySelectorAll('live stream name');
        // we would use forEach but it does not work on Safari <10
        for (let i = 0; i < nodes.length; i++) {
          this.get('streams').pushObject(nodes[i].textContent);
        }
      });
  },
  actions: {
    changeStreams(target) {
      if (target.checked) {
        this.get('enabledStreams').pushObject(target.value);
      } else {
        this.get('enabledStreams').removeObject(target.value);
      }
      console.log(this.get('enabledStreams'));
    }
  }
});
