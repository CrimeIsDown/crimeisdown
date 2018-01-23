import Ember from 'ember';
import ENV from '../config/environment';
import fetch from 'fetch';
import dashjs from 'npm:dashjs';

export default Ember.Component.extend({
  stream: null,
  streams: [],
  player: null,
  mediaSourceSupported: true,
  init() {
    this._super(...arguments);
    fetch('https://audio.crimeisdown.com/streaming/stat')
      .then(response => response.text())
      .then(xml => (new window.DOMParser()).parseFromString(xml, 'text/xml'))
      .then(data => {
        let nodes = data.querySelectorAll('live stream name');
        // we would use forEach but it does not work on Safari <10
        for (let i = 0; i < nodes.length; i++) {
          console.log(nodes[i].textContent);
          this.get('streams').pushObject(nodes[i].textContent);
        }
      });
    this.set('player', dashjs.MediaPlayer().create());
    this.get('player').getDebug().setLogToBrowserConsole(ENV.APP.MEDIA_PLAYER_DEBUG);
    this.get('player').on(dashjs.MediaPlayer.events.ERROR, payload => {
      console.error(payload);
      if (payload.error === 'capability' && payload.event === 'mediasource') {
        this.set('mediaSourceSupported', false);
      }
    }, this);
  },
  didInsertElement() {
    let hasWebKit = ('WebKitMediaSource' in window);
    let hasMediaSource = ('MediaSource' in window);
    let isSafari = navigator.userAgent.search("Safari") > 0 && navigator.userAgent.search("Chrome") < 0;
    this.set('mediaSourceSupported', (hasWebKit || hasMediaSource) && !isSafari);

    this.set('playerElement', document.getElementById('streamplayer'));
    if (this.get('mediaSourceSupported')) {
      this.get('player').initialize(this.get('playerElement'));
    } else {
      console.error('Sorry, your browser does not support our live streaming functionality.');
    }
  },
  actions: {
    stream(value) {
      this.set('stream', value);
      if (this.get('mediaSourceSupported')) {
        this.get('player').attachSource('https://audio.crimeisdown.com/streaming/dash/' + value + '/');
      } else {
        this.get('playerElement').src = 'https://audio.crimeisdown.com/streaming/hls/' + value + '/index.m3u8';
      }
    },
    seek(time) {
      if (this.get('mediaSourceSupported')) {
        this.get('player').seek(time);
      } else {
        this.get('playerElement').fastSeek(time);
      }
    }
  }
});
