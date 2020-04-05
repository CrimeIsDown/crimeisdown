/*global MediaElementPlayer*/

import Component from '@glimmer/component';

export default class StreamPlayer extends Component {
  constructor() {
    super(...arguments);
  }

  initializeMediaPlayer(playerElement, args) {
    let stream = args[0];
    let autoplay = args[1];

    let options = {
      pluginPath: "https://cdn.jsdelivr.net/npm/mediaelement@4.2.12/build/",
      shimScriptAccess: 'always',
      isVideo: false,
      pauseOtherPlayers: false,
      features: ['playpause', 'current', 'volume']
    };
    let src = {};

    const isMobileSafari = navigator.userAgent.match(/(iPod|iPhone|iPad)/) && navigator.userAgent.match(/AppleWebKit/);
    const mediaSourceSupported = (('MediaSource' in window) || ('WebKitMediaSource' in window)) && !isMobileSafari;

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

    let audioPlayer = new MediaElementPlayer(playerElement, options);
    audioPlayer.setSrc(src);

    if (autoplay) {
      audioPlayer.load();
      audioPlayer.play();
    }
  }
}
