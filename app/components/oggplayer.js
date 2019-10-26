import Component from '@ember/component';

export default Component.extend({
  didInsertElement() {
    this._super(...arguments);
    let player = window.videojs('videojs-ogvjs-player', {
      controls: true,
      plugins: {
        wavesurfer: {
          backend: 'MediaElement',
          msDisplayMax: 0,
          waveColor: '#0F0',
          progressColor: '#0A0',
          cursorColor: '#FFF',
        }
      },
      techOrder: ['ogvjs'],
      ogvjs: { base: '/assets/ogv' }
    }, () => {
      player.src({src: this.url, type: 'audio/ogg; codecs="opus"'});
    });
  }
});
