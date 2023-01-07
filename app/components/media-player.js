import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class MediaPlayer extends Component {
  @tracked
  minZoom = 0;
  @tracked
  maxZoom = 100;
  @tracked
  currentZoom = 0;

  idSuffix = '';

  constructor() {
    super(...arguments);
  }

  @action
  initializeMediaPlayer(src, type, idSuffix) {
    this.idSuffix = idSuffix;
    const playerElement = document.querySelector('#videojs-player' + idSuffix);
    const timelineElement = document.querySelector('#timeline' + idSuffix);
    let options = {
      controls: true,
      techOrder: ['html5'],
      plugins: {
        wavesurfer: {
          backend: 'MediaElement',
          displayMilliseconds: false,
          interact: true,
          waveColor: '#0F0',
          progressColor: '#0A0',
          cursorColor: '#FFF',
          plugins: [
            window.WaveSurfer.timeline.create({
              container: timelineElement,
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
    window['player' + this.idSuffix] = window.videojs(
      playerElement,
      options,
      () => {
        window['player' + this.idSuffix].src({ src: src, type: type });
      }
    );
  }

  @action
  teardownMediaPlayer() {
    window['player' + this.idSuffix].dispose();
  }

  @action
  zoom(e) {
    let wavesurfer = window['player' + this.idSuffix].wavesurfer().surfer;
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
