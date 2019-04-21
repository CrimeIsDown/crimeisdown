/*global MediaElementPlayer*/

import Component from '@ember/component';
import EmberObject from '@ember/object';
import { bind } from '@ember/runloop';
import fetch from 'fetch';
import $ from 'jquery';

export default Component.extend({
  dragScale: 50,
  init() {
    this._super(...arguments);
    this.streams = [];
    this.enabledStreams = [];

    this.audioContext = new (window.AudioContext || window.webkitAudioContext);
    this.setupResonanceScene();

    this.set('mediaSourceSupported', (('MediaSource' in window) || ('WebKitMediaSource' in window))/* && !mejs.Features.isiOS*/);

    this.onMove = (event) => {
      let target = event.target,
        // keep the dragged position in the data-x/data-y attributes
        x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
        y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
      x = Math.max(0, x);
      y = Math.max(0, y);

      target.style.webkitTransform = target.style.transform = 'translate(' + x + 'px, ' + y + 'px)';

      target.setAttribute('data-x', x);
      target.setAttribute('data-y', y);
    };
    this.onEnd = (event) => {
      let target = event.target,
        x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
        y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
      let streamName = event.target.id.replace('drag-', '');
      let streamData = this.enabledStreams.findBy('name', streamName);
      if (streamData) {
        let roomPos = this.dragPositionToRoomPosition(x, y);
        streamData.soundSource.setPosition(roomPos.x, roomPos.y, roomPos.z);
      }
    };
    fetch('https://audio.crimeisdown.com/streaming/stat')
      .then(response => response.text())
      .then(xml => (new window.DOMParser()).parseFromString(xml, 'text/xml'))
      .then(data => {
        let nodes = data.querySelectorAll('live stream name');
        // we would use forEach but it does not work on Safari <10
        for (let i = 0; i < nodes.length; i++) {
          this.streams.pushObject(nodes[i].textContent);
        }
      });
  },
  didInsertElement() {
    window.interact('.draggable')
      .draggable({
        restrict: {
          restriction: "parent",
          endOnly: true,
          elementRect: { top: 0.05, left: 0.05, bottom: 0.95, right: 0.95 }
        },
        autoScroll: true,
        onmove: this.onMove,
        onend: this.onEnd
      });
  },
  actions: {
    changeStreams(target) {
      if (target.checked) {
        this.addStream(target.value);
      } else {
        this.removeStream(target.value);
      }
    },
    seekStream(time) {
      if (this.mediaSourceSupported) {
        this.player.seek(time);
      } else {
        this.playerElement.fastSeek(time);
      }
    }
  },
  setupResonanceScene() {
    this.resonanceScene = new window.ResonanceAudio(this.audioContext, {
      ambisonicOrder: 1,
    });
    this.sceneDimensions = {
      width: 4, height: 4, depth: 4,
    };
    // this.sceneMaterials = {
    //   left: 'uniform', right: 'uniform',
    //   up: 'transparent', down: 'transparent',
    //   front: 'uniform', back: 'uniform',
    // };
    // Commented out b/c of https://github.com/resonance-audio/resonance-audio-web-sdk/issues/16
    // this.resonanceScene.setRoomProperties(this.sceneDimensions, this.sceneMaterials);
    this.resonanceScene.output.connect(this.audioContext.destination);
  },
  addStream(streamName) {
    let streamData = EmberObject.create({name: streamName});
    this.enabledStreams.pushObject(streamData);

    // wait for new elements to render so we can select them
    $('#stream-'+streamName).ready(bind(this, () => {
      let playerElement = document.getElementById('audio-player-' + streamName);

      // AudioContext must be resumed after the document received a user gesture to enable audio playback.
      this.audioContext.resume();

      let player = this.startPlayer(streamName, playerElement);
      let position = this.randomPosition(this.sceneDimensions.width, this.sceneDimensions.height, this.sceneDimensions.depth);
      let draggableElement = this.addDraggable(streamName, position);
      $('.draggable-parent').append(draggableElement);

      player.media.addEventListener('canplay', () => {
        if (this.audioContext) {
          // Get the real media element
          playerElement = document.getElementById(player.media.renderer.id);
          let audioElementSource = this.audioContext.createMediaElementSource(playerElement);

          let analyser = this.audioContext.createAnalyser();
          analyser.smoothingTimeConstant = 0.5;
          analyser.fftSize = 512; // the total samples are half the fft size.
          audioElementSource.connect(analyser);

          let volume = this.audioContext.createGain();
          player.media.addEventListener('volumechange', () => {
            volume.gain.setValueAtTime(player.getVolume(), this.audioContext.currentTime);
          });
          analyser.connect(volume);

          let soundSource = this.resonanceScene.createSource();

          soundSource.setPosition(position.x, 0, position.z);
          volume.connect(soundSource.input);

          streamData.setProperties({
            audioElementSource: audioElementSource,
            analyser: analyser,
            volume: volume,
            soundSource: soundSource,
            position: position,
            draggableElement: draggableElement
          });

          this.drawVU(analyser, draggableElement, 0);
        }
      });
    }));
  },
  startPlayer(stream, playerElement) {
    let audioPlayer;
    if (this.mediaSourceSupported) {
      audioPlayer = new MediaElementPlayer(playerElement, {
        pluginPath: "https://cdn.jsdelivr.net/npm/mediaelement@4.2.9/build/",
        shimScriptAccess: 'always',
        renderers: ['native_dash', 'flash_dash'],
        isVideo: false,
        pauseOtherPlayers: false,
        features: ['playpause', 'current', 'volume']
      });
      audioPlayer.setSrc({
        src: 'https://audio.crimeisdown.com/streaming/dash/' + stream + '/',
        type: 'application/dash+xml'
      });
    } else {
      audioPlayer = new MediaElementPlayer(playerElement, {
        pluginPath: "https://cdn.jsdelivr.net/npm/mediaelement@4.2.9/build/",
        shimScriptAccess: 'always',
        renderers: ['html5', 'native_hls', 'flash_hls'],
        isVideo: false,
        pauseOtherPlayers: false,
        features: ['playpause', 'current', 'volume']
      });
      audioPlayer.setSrc({
        src: 'https://audio.crimeisdown.com/streaming/hls/' + stream + '/index.m3u8',
        type: 'application/x-mpegURL'
      });
    }
    audioPlayer.load();
    audioPlayer.play();
    return audioPlayer;
  },
  removeStream(streamName) {
    let streamData = this.enabledStreams.findBy('name', streamName);
    if (this.mediaSourceSupported) {
      streamData.draggableElement.remove();
      streamData.soundSource.input.disconnect();
      streamData.volume.disconnect();
      streamData.analyser.disconnect();
      streamData.audioElementSource.disconnect();
    }
    this.enabledStreams.removeObject(streamData);
  },
  addDraggable(streamName, roomPosition) {
    let draggableElement = document.getElementById('drag-' + streamName);
    let dragPos = this.roomPositionToDragPosition(roomPosition);
    draggableElement.style.transform = 'translate('+dragPos.dragX+'px, '+dragPos.dragY+'px)';
    draggableElement.setAttribute('data-x', dragPos.dragX);
    draggableElement.setAttribute('data-y', dragPos.dragY);
    return draggableElement;
  },
  drawVU(analyser, canvasContext, lastVal) {
    let array = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(array);

    let max = 0;
    for (let i = 0; i < array.length; i++) {
      max = Math.max(max, Math.abs(array[i] - 128));
    }

    let val = Math.round(max * 4);

    // optimization to avoid unnecessary repaints
    if (val !== lastVal) {
      canvasContext.style.color = 'rgb(0,' + val + ',0)';
    }

    requestAnimationFrame(() => {
      this.drawVU(analyser, canvasContext, val);
    });
  },
  randomPosition(width, height, depth) {
    function randomAxisPosition(len) {
      let max = len/2;
      let min = -len/2;
      return (Math.random() * (max - min) + min) * 0.9;
    }
    return {
      x: randomAxisPosition(width),
      y: 0,
      z: randomAxisPosition(depth)
    };
  },
  roomPositionToDragPosition(position) {
    return {
      dragX: (position.x + this.sceneDimensions.width/2) * this.dragScale,
      dragY: (position.z + this.sceneDimensions.depth/2) * this.dragScale,
    };
  },
  dragPositionToRoomPosition(x, y) {
    let maxWidth = this.sceneDimensions.width/2;
    let maxDepth = this.sceneDimensions.depth/2;
    return {
      x: Math.min(maxWidth, Math.max(-maxWidth, (x / this.dragScale) - maxWidth)),
      y: 0,
      z: Math.min(maxDepth, Math.max(-maxDepth, (y / this.dragScale) - maxDepth))
    };
  }
});
