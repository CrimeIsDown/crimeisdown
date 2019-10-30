import Component from '@ember/component';
import { debounce } from '@ember/runloop';

export default Component.extend({
  zoomlevel: 9,
  player: null,
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

    this.player = window.videojs('videojs-player', options, () => {
      this.player.src({src: this.src, type: this.type});
    });
  },
  actions: {
    zoom(e) {
      debounce(this, (value) => {
        this.player.wavesurfer().surfer.zoom(Number(value));
      }, e.target.value, 100);
    }
  }
});
