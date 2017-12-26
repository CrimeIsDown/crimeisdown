import Ember from 'ember';
import ENV from '../config/environment';
import fetch from 'fetch';
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
        let nodes = data.querySelectorAll('live stream name');
        // we would use forEach but it does not work on Safari <10
        for (let i = 0; i < nodes.length; i++) {
          this.get('streams').pushObject(nodes[i].innerHTML);
        }
      });
    this.set('player', dashjs.MediaPlayer().create());
    this.get('player').getDebug().setLogToBrowserConsole(ENV.APP.MEDIA_PLAYER_DEBUG);
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
