/*global dashjs*/

import Component from '@ember/component';
import { computed } from '@ember/object';
import ENV from '../config/environment';

export default Component.extend({
  stream: computed('params.[]', function(){
    return this.get('params')[0];
  }),
  player: null,
  mediaSourceSupported: true,
  init() {
    this._super(...arguments);
    this.set('player', dashjs.MediaPlayer().create());
    this.get('player').getDebug().setLogToBrowserConsole(ENV.APP.MEDIA_PLAYER_DEBUG);
    this.get('player').on(dashjs.MediaPlayer.events.ERROR, payload => {
      // console.error(payload);
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

    this.set('playerElement', document.getElementById('audio-player-'+this.get('stream')));
    if (this.get('mediaSourceSupported')) {
      this.get('player').initialize(this.get('playerElement'));
      this.get('player').attachSource('https://audio.crimeisdown.com/streaming/dash/' + this.get('stream') + '/');
    } else {
      this.get('playerElement').src = 'https://audio.crimeisdown.com/streaming/hls/' + this.get('stream') + '/index.m3u8';
      // console.error('Sorry, your browser does not support our live streaming functionality.');
    }
  },
  actions: {
    seek(time) {
      if (this.get('mediaSourceSupported')) {
        this.get('player').seek(time);
      } else {
        this.get('playerElement').fastSeek(time);
      }
    }
  }
});
