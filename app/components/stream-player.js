/*global MediaElementPlayer*/

import Component from '@glimmer/component';

export default class StreamPlayer extends Component {
  initializeMediaPlayer(stream, autoplay) {
    const isMobileSafari =
      navigator.userAgent.match(/(iPod|iPhone|iPad)/) &&
      navigator.userAgent.match(/AppleWebKit/);
    const mediaSourceSupported =
      ('MediaSource' in window || 'WebKitMediaSource' in window) &&
      !isMobileSafari;

    let options = {
      pluginPath: 'https://cdn.jsdelivr.net/npm/mediaelement@5.1.0/build/',
      shimScriptAccess: 'always',
      isVideo: false,
      pauseOtherPlayers: false,
      features: ['playpause', 'current', 'volume'],
    };
    let src;

    if (stream.broadcastify) {
      options['renderers'] = ['html5'];

      src = {
        src: stream.broadcastify,
        type: 'audio/mpeg',
      };
    } else if (mediaSourceSupported) {
      options['renderers'] = ['native_dash', 'flash_dash'];
      options['dash'] = {
        path: 'https://cdn.dashjs.org/v3.2.0/dash.all.min.js',
      };

      src = {
        src:
          'https://audio.crimeisdown.com/streaming/dash/' + stream.slug + '/',
        type: 'application/dash+xml',
      };
    } else {
      options['renderers'] = ['html5', 'native_hls', 'flash_hls'];
      options['hls'] = { path: 'https://cdn.jsdelivr.net/npm/hls.js@0.14.17' };

      src = {
        src:
          'https://audio.crimeisdown.com/streaming/hls/' +
          stream.slug +
          '/index.m3u8',
        type: 'application/x-mpegURL',
      };
    }

    let playerElement = document.getElementById('stream-player-' + stream.slug);

    let mediaElementPlayer = new MediaElementPlayer(playerElement, options);
    mediaElementPlayer.setSrc(src);

    if (autoplay) {
      mediaElementPlayer.load();
      mediaElementPlayer.play();
    }
  }
}
