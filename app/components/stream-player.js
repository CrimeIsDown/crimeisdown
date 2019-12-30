/*global MediaElementPlayer*/

import Component from '@ember/component';

export default Component.extend({
  init() {
    this._super(...arguments);
    let isMobileSafari = navigator.userAgent.match(/(iPod|iPhone|iPad)/) && navigator.userAgent.match(/AppleWebKit/);
    this.set('mediaSourceSupported', (('MediaSource' in window) || ('WebKitMediaSource' in window)) && !isMobileSafari);
  },

  didInsertElement() {
    this.set('audioPlayer', this.initializeMediaPlayer(this.stream, this.mediaSourceSupported));

    if (this.autoplay) {
      this.audioPlayer.load();
      this.audioPlayer.play();
    }
  },

  initializeMediaPlayer(stream, mediaSourceSupported) {
    let options = {
      pluginPath: "https://cdn.jsdelivr.net/npm/mediaelement@4.2.12/build/",
      shimScriptAccess: 'always',
      isVideo: false,
      pauseOtherPlayers: false,
      features: ['playpause', 'current', 'volume']
    };
    let src = {};

    if (mediaSourceSupported) {
      options['renderers'] = ['native_dash', 'flash_dash'];
      options['dash'] = { path: 'https://cdn.dashjs.org/v3.0.0/dash.all.min.js' };

      src = {
        src: 'https://audio.crimeisdown.com/streaming/dash/' + stream + '/',
        type: 'application/dash+xml'
      };
    } else {
      options['renderers'] = ['html5', 'native_hls', 'flash_hls'];
      options['hls'] = { path: 'https://cdn.jsdelivr.net/npm/hls.js@0.12.4' };

      src = {
        src: 'https://audio.crimeisdown.com/streaming/hls/' + stream + '/index.m3u8',
        type: 'application/x-mpegURL'
      };
    }

    let playerElement = document.getElementById('stream-player-' + stream);

    let mediaElementPlayer = new MediaElementPlayer(playerElement, options);
    mediaElementPlayer.setSrc(src);
    return mediaElementPlayer;
  }
});
