import Component from '@ember/component';

export default Component.extend({
  minZoom: 0,
  maxZoom: 100,
  currentZoom: 0,
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
          plugins: [
            window.WaveSurfer.timeline.create({
              container: '#timeline'
            })
          ]
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
      let wavesurfer = this.player.wavesurfer().surfer;
      let playerWidth = wavesurfer.drawer.getWidth();
      let minPxPerSec = Math.round((playerWidth * wavesurfer.params.pixelRatio) / wavesurfer.getDuration());
      let defaultMinPxPerSec = 20;

      wavesurfer.zoom(minPxPerSec * (Number(e.target.value)/defaultMinPxPerSec));
    }
  }
});
