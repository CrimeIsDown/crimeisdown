import Component from '@ember/component';

export default Component.extend({
  didInsertElement() {
    this._super(...arguments);
    let options = {
      controls: true,
      plugins: {
        wavesurfer: {
          backend: 'MediaElement',
          msDisplayMax: 0,
          waveColor: '#0F0',
          progressColor: '#0A0',
          cursorColor: '#FFF',
        }
      }
    };

    if (this.type.includes('ogg')) {
      options.techOrder = ['ogvjs'];
      options.ogvjs = { base: '/assets/ogv' };
    }

    let player = window.videojs('videojs-player', options, () => {
      player.src({src: this.src, type: this.type});
    });
  }
});
