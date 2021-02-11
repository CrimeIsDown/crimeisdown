import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class Oggplayer extends Component {
  @tracked
  minZoom = 0;
  @tracked
  maxZoom = 100;
  @tracked
  currentZoom = 0;

  constructor() {
    super(...arguments);
  }

  initializeMediaPlayer(playerElement, args) {
    let src = args[0];
    let type = args[1];
    let options = {
      controls: true,
      techOrder: ['html5'],
      plugins: {
        wavesurfer: {
          backend: 'MediaElement',
          msDisplayMax: 0,
          waveColor: '#0F0',
          progressColor: '#0A0',
          cursorColor: '#FFF',
          plugins: [
            window.WaveSurfer.timeline.create({
              container: '#timeline',
            }),
          ],
        },
      },
    };

    if (type.includes('ogg')) {
      options.techOrder = ['ogvjs'];
      options.ogvjs = { base: '/assets/ogv' };
    }

    // This is a bad idea, but it works for sharing scope
    window.oggplayer = window.videojs('videojs-player', options, () => {
      window.oggplayer.src({ src: src, type: type });
    });
  }

  @action
  zoom(e) {
    let wavesurfer = window.oggplayer.wavesurfer().surfer;
    let playerWidth = wavesurfer.drawer.getWidth();
    let minPxPerSec = Math.round(
      (playerWidth * wavesurfer.params.pixelRatio) / wavesurfer.getDuration()
    );
    let defaultMinPxPerSec = 20;

    wavesurfer.zoom(
      minPxPerSec * (Number(e.target.value) / defaultMinPxPerSec)
    );
  }
}
