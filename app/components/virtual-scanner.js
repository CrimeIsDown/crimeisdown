/*global MediaElementPlayer, mejs*/

import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import EmberObject, { action } from '@ember/object';
import { A } from '@ember/array';
import fetch from 'fetch';

export default class VirtualScanner extends Component {
  dragScale = 50;

  @tracked
  streams = A([]);
  @tracked
  enabledStreams = A([]);

  constructor() {
    super(...arguments);

    this.loadStreamsPromise = this.loadStreams();
  }

  async loadStreams() {
    let nodes = [];
    try {
      const response = await fetch(
        'https://audio.crimeisdown.com/streaming/stat',
      );
      if (response.status == 200) {
        const parser = new window.DOMParser().parseFromString(
          await response.text(),
          'text/xml',
        );
        nodes = parser.querySelectorAll('live stream');
      }
    } catch (e) {
      console.error(e);
    }

    for (const node of nodes) {
      if (node.querySelector('active')) {
        let streamData = {
          name: node.querySelector('name').textContent,
          desc: node.querySelector('name').textContent,
          order: 999,
        };
        for (const [index, stream] of this.args.streams.entries()) {
          if (stream.slug === streamData.name) {
            streamData = {
              name: streamData.name,
              desc: stream.shortname ?? stream.name,
              order: index,
              openmhz: stream.openmhz,
            };
            break;
          }
        }
        this.streams.pushObject(streamData);
      }
    }

    for (const [index, stream] of this.args.streams.entries()) {
      if (stream.broadcastify) {
        stream.broadcastifyUrl =
          'https://www.broadcastify.com/listen/feed/' + stream.broadcastifyId;
      }
      if (
        !this.streams.find((streamObj) => streamObj.name == stream.slug) &&
        (stream.broadcastify ||
          stream.name.startsWith('CFD') ||
          stream.name.startsWith('CPD Citywide'))
      ) {
        this.streams.pushObject({
          name: stream.slug,
          desc: stream.shortname ?? stream.name,
          order: index,
          broadcastify: stream.broadcastify,
          broadcastifyUrl: stream.broadcastifyUrl,
          openmhz: stream.openmhz,
          disabled:
            stream.name.startsWith('CFD') ||
            stream.name.startsWith('CPD Citywide'),
        });
      }
    }

    this.streams.sort((a, b) => {
      if (a.order < b.order) return -1;
      if (a.order > b.order) return 1;
      return 0;
    });
  }

  @action
  setupDraggable() {
    const onmove = (event) => {
      let target = event.target,
        // keep the dragged position in the data-x/data-y attributes
        x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
        y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
      x = Math.max(0, x);
      y = Math.max(0, y);

      target.style.webkitTransform = target.style.transform =
        'translate(' + x + 'px, ' + y + 'px)';

      target.setAttribute('data-x', x);
      target.setAttribute('data-y', y);
    };
    const onend = (event) => {
      let target = event.target,
        x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
        y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
      let streamName = event.target.id.replace('drag-', '');
      let streamData = this.enabledStreams.findBy('name', streamName);
      if (streamData) {
        let roomPos = this.dragPositionToRoomPosition(x, y);
        if (streamData.soundSource) {
          streamData.soundSource.setPosition(roomPos.x, roomPos.y, roomPos.z);
        } else if (streamData.panner) {
          streamData.panner.pan.setValueAtTime(
            roomPos.x / 2,
            this.audioContext.currentTime,
          );
        }
      }
    };

    window.interact('.draggable').draggable({
      restrict: {
        restriction: '.draggable-parent',
        endOnly: true,
      },
      autoScroll: true,
      onmove,
      onend,
    });
  }

  @action
  async changeStreams(event) {
    await this.loadStreamsPromise;

    if (event.target.checked) {
      this.setupResonanceScene();
      this.enabledStreams.pushObject(
        EmberObject.create(this.streams.findBy('name', event.target.value)),
      );
    } else {
      this.removeStream(event.target.value);
    }
  }

  @action
  seekStream(time) {
    if (this.mediaSourceSupported) {
      this.player.seek(time);
    } else {
      this.playerElement.fastSeek(time);
    }
  }

  setupResonanceScene() {
    // Only do this if we haven't run it before
    if (this.audioContext) return;

    if (!(window.AudioContext || window.webkitAudioContext)) {
      alert(
        'Sorry, your browser does not support our own audio streaming. Please check out some of the other streaming links on this page, or switch to a browser like Chrome that is supported.',
      );
      return;
    }

    // Instantiate the context on user interaction
    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    this.mediaSourceSupported =
      ('MediaSource' in window || 'WebKitMediaSource' in window) &&
      !mejs.Features.isiOS;

    this.sceneDimensions = {
      width: 4,
      height: 4,
      depth: 4,
    };
    this.sceneMaterials = {
      left: 'uniform',
      right: 'uniform',
      up: 'transparent',
      down: 'transparent',
      front: 'uniform',
      back: 'uniform',
    };

    const resonanceAudioSupported = this.mediaSourceSupported;
    if (resonanceAudioSupported && this.audioContext) {
      this.resonanceScene = new window.ResonanceAudio(this.audioContext, {
        ambisonicOrder: 1,
      });

      // Commented out b/c of https://github.com/resonance-audio/resonance-audio-web-sdk/issues/16
      // this.resonanceScene.setRoomProperties(this.sceneDimensions, this.sceneMaterials);
      this.resonanceScene.output.connect(this.audioContext.destination);
    }
  }

  @action
  async startStream(streamName) {
    let streamData = this.enabledStreams.findBy('name', streamName);

    let playerElement = document.getElementById('audio-player-' + streamName);

    // AudioContext must be resumed after the document received a user gesture to enable audio playback.
    this.audioContext.resume();

    let player = await this.buildPlayer(streamData, playerElement);
    await player.load();
    streamData.set(
      'position',
      this.randomPosition(
        this.sceneDimensions.width,
        this.sceneDimensions.height,
        this.sceneDimensions.depth,
      ),
    );
    streamData.set(
      'draggableElement',
      this.addDraggable(streamName, streamData.position),
    );

    player.media.addEventListener(
      'canplay',
      this.onCanPlay.bind(this, streamData),
    );
  }

  async onCanPlay(streamData, event) {
    const target = event.detail.target;
    target.removeEventListener(
      'canplay',
      this.onCanPlay.bind(this, streamData),
    );
    // Get the real media element
    let playerElement = target.renderer;
    if (!playerElement) {
      playerElement = target.player.domNode;
    }

    if (streamData.audioElementSource) {
      console.error(
        'Already existing audioElementSource for element ' + playerElement.id,
      );
      return;
    }
    const audioElementSource =
      this.audioContext.createMediaElementSource(playerElement);
    streamData.set('audioElementSource', audioElementSource);

    const analyser = this.audioContext.createAnalyser();
    analyser.smoothingTimeConstant = 1;
    analyser.fftSize = 256; // the total samples are half the fft size.
    streamData.audioElementSource.connect(analyser);
    streamData.set('analyser', analyser);

    let volume = this.audioContext.createGain();
    target.addEventListener('volumechange', () => {
      volume.gain.setValueAtTime(
        target.getVolume(),
        this.audioContext.currentTime,
      );
    });
    streamData.analyser.connect(volume);
    streamData.set('volume', volume);

    if (this.resonanceScene) {
      const soundSource = this.resonanceScene.createSource();
      soundSource.setPosition(streamData.position.x, 0, streamData.position.z);
      volume.connect(soundSource.input);
      streamData.set('soundSource', soundSource);
    } else {
      const panner = this.audioContext.createStereoPanner();
      panner.pan.value = streamData.position.x / 2;
      volume.connect(panner);
      panner.connect(this.audioContext.destination);
      streamData.set('panner', panner);
    }

    if (analyser) {
      this.drawVU(analyser, streamData.draggableElement, 0);
    }

    try {
      await target.play();
    } catch (e) {
      alert(`Error playing ${streamData.name}: ${e}`);
    }
  }

  async buildPlayer(streamData, playerElement) {
    let audioPlayer;
    let mediaElementConfig = {
      pluginPath: 'https://cdn.jsdelivr.net/npm/mediaelement@5.1.0/build/',
      iconSprite: '/assets/images/mejs-controls.svg',
      shimScriptAccess: 'always',
      isVideo: false,
      pauseOtherPlayers: false,
      features: ['playpause', 'current', 'volume'],
    };
    if (streamData.broadcastify) {
      audioPlayer = new MediaElementPlayer(playerElement, {
        renderers: ['html5'],
        ...mediaElementConfig,
      });
      audioPlayer.setSrc({
        src: streamData.broadcastify,
        type: 'audio/mpeg',
      });
    } else if (this.mediaSourceSupported) {
      audioPlayer = new MediaElementPlayer(playerElement, {
        renderers: ['native_dash', 'flash_dash'],
        dash: { path: 'https://cdn.dashjs.org/v3.2.0/dash.all.min.js' },
        ...mediaElementConfig,
      });
      audioPlayer.setSrc({
        src:
          'https://audio.crimeisdown.com/streaming/dash/' +
          streamData.name +
          '/',
        type: 'application/dash+xml',
      });
    } else {
      audioPlayer = new MediaElementPlayer(playerElement, {
        renderers: ['html5', 'native_hls', 'flash_hls'],
        hls: { path: 'https://cdn.jsdelivr.net/npm/hls.js@0.14.17' },
        ...mediaElementConfig,
      });
      audioPlayer.setSrc({
        src:
          'https://audio.crimeisdown.com/streaming/hls/' +
          streamData.name +
          '/index.m3u8',
        type: 'application/x-mpegURL',
      });
    }
    return audioPlayer;
  }

  removeStream(streamName) {
    const streamData = this.enabledStreams.findBy('name', streamName);
    if (streamData.soundSource) streamData.soundSource.input.disconnect();
    if (streamData.panner) streamData.panner.disconnect();
    if (streamData.volume) streamData.volume.disconnect();
    if (streamData.analyser) streamData.analyser.disconnect();
    if (streamData.audioElementSource)
      streamData.audioElementSource.disconnect();
    this.enabledStreams.removeObject(streamData);
  }

  addDraggable(streamName, roomPosition) {
    const draggableElement = document.getElementById('drag-' + streamName);
    const dragPos = this.roomPositionToDragPosition(roomPosition);
    draggableElement.style.transform =
      'translate(' + dragPos.dragX + 'px, ' + dragPos.dragY + 'px)';
    draggableElement.setAttribute('data-x', dragPos.dragX);
    draggableElement.setAttribute('data-y', dragPos.dragY);
    return draggableElement;
  }

  drawVU(analyser, element, lastVal) {
    const array = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(array);

    let max = 0;
    for (let i = 0; i < array.length; i++) {
      max = Math.max(max, Math.abs(array[i] - 128));
    }

    const val = Math.round(max * 16);

    // optimization to avoid unnecessary repaints
    if (val !== lastVal) {
      element.style.color = 'rgb(0,' + val + ',0)';
    }

    requestAnimationFrame(() => {
      this.drawVU(analyser, element, val);
    });
  }

  randomPosition(width, height, depth) {
    function randomAxisPosition(len) {
      const max = len / 2;
      const min = -len / 2;
      return (Math.random() * (max - min) + min) * 0.9;
    }
    return {
      x: randomAxisPosition(width),
      y: 0,
      z: randomAxisPosition(depth),
    };
  }

  roomPositionToDragPosition(position) {
    return {
      dragX: (position.x + this.sceneDimensions.width / 2) * this.dragScale,
      dragY: (position.z + this.sceneDimensions.depth / 2) * this.dragScale,
    };
  }

  dragPositionToRoomPosition(x, y) {
    const maxWidth = this.sceneDimensions.width / 2;
    const maxDepth = this.sceneDimensions.depth / 2;
    return {
      x: Math.min(maxWidth, Math.max(-maxWidth, x / this.dragScale - maxWidth)),
      y: 0,
      z: Math.min(maxDepth, Math.max(-maxDepth, y / this.dragScale - maxDepth)),
    };
  }
}
