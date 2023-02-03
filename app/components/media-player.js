import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class MediaPlayer extends Component {
  options = {};
  @tracked
  minZoom = 0;
  @tracked
  maxZoom = 100;
  @tracked
  currentZoom = 0;

  idSuffix = '';

  constructor() {
    super(...arguments);
    this.options = {
      aspectRatio: '4:1',
      preload: this.args.preload,
      controls: true,
      techOrder: ['html5'],
    };

    if (this.args.type.includes('ogg')) {
      this.options.techOrder = ['ogvjs'];
      this.options.ogvjs = { base: '/assets/ogv' };
    }

    this.plugins = {
      wavesurfer: {
        displayMilliseconds: false,
        interact: true,
        normalize: true,
        waveColor: '#0F0',
        progressColor: '#0A0',
        cursorColor: '#FFF',
        plugins: [],
      },
    };

    if (!this.args.hideZoom) {
      this.plugins.wavesurfer.plugins.push(
        window.WaveSurfer.timeline.create({
          container: '#timeline' + this.idSuffix,
        })
      );
    }

    this.options.plugins = this.plugins;
  }

  @action
  initializeMediaPlayer(target) {
    this.player = window.videojs(target, this.options, () => {
      const src = {
        src: this.args.src,
        type: this.args.type,
      };
      if (this.args.preload === 'none') {
        src.peaks =
          'data:application/json;charset=utf-8,%7B%22version%22%3A2%2C%22channels%22%3A1%2C%22sample_rate%22%3A8000%2C%22samples_per_pixel%22%3A1%2C%22bits%22%3A8%2C%22length%22%3A108%2C%22data%22%3A%5B0%5D%7D';
      }
      this.player.src(src);
      if (this.args.preload === 'none') {
        this.player.one('play', async () => {
          const element = this.player.tech_.el();
          await this.player.wavesurfer().load(element);
          await this.player.play();
          await this.player.wavesurfer().surfer.play();
        });
      }
    });
  }

  @action
  teardownMediaPlayer() {
    this.player.dispose();
  }

  @action
  zoom(e) {
    let wavesurfer = this.player.wavesurfer().surfer;
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
