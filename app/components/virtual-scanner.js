import Ember from 'ember';
import dashjs from 'npm:dashjs';

export default Ember.Component.extend({
  stream: null,
  streams: [],
  player: null,
  init() {
    this._super(...arguments);
    fetch('https://audio.crimeisdown.com/streaming/stat')
      .then(response => response.text())
      .then(xml => (new window.DOMParser()).parseFromString(xml, 'text/xml'))
      .then(data => {
        data.querySelectorAll('live stream name').forEach(node => {
          this.get('streams').pushObject(node.innerHTML);
        });
      });
    this.set('player', dashjs.MediaPlayer().create());
  },
  didInsertElement() {
    this.get('player').initialize(document.querySelector('#streamplayer'));
  },
  actions: {
    stream(value) {
      this.set('stream', value);
      this.get('player').attachSource('https://audio.crimeisdown.com/streaming/dash/'+value+'/');
    },
    seek(time) {
      this.get('player').seek(time);
    }
  }
});
