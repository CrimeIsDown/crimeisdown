/*global dashjs*/

import Component from '@ember/component';
import EmberObject from '@ember/object';
import ENV from '../config/environment';
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

    let isSafari = navigator.userAgent.search("Safari") > 0 && navigator.userAgent.search("Chrome") < 0;
    this.set('mediaSourceSupported', (('MediaSource' in window) || ('WebKitMediaSource' in window)) && !isSafari);

    this.onMove = (event) => {
      let target = event.target,
        // keep the dragged position in the data-x/data-y attributes
        x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
        y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

      target.style.webkitTransform = target.style.transform = 'translate(' + x + 'px, ' + y + 'px)';

      target.setAttribute('data-x', x);
      target.setAttribute('data-y', y);
    };
    this.onEnd = (event) => {
      let target = event.target,
        x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
        y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
      let streamName = event.target.id.replace('drag-', '');
      let streamData = this.get('enabledStreams').findBy('name', streamName);
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
          this.get('streams').pushObject(nodes[i].textContent);
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
      if (this.get('mediaSourceSupported')) {
        this.get('player').seek(time);
      } else {
        this.get('playerElement').fastSeek(time);
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
    this.sceneMaterials = {
      left: 'uniform', right: 'uniform',
      up: 'transparent', down: 'transparent',
      front: 'uniform', back: 'uniform',
    };
    this.resonanceScene.setRoomProperties(this.sceneDimensions, this.sceneMaterials);
    this.resonanceScene.output.connect(this.audioContext.destination);
  },
  addStream(streamName) {
    let streamData = EmberObject.create({name: streamName});
    this.get('enabledStreams').pushObject(streamData);

    // wait for new elements to render so we can select them
    $('#stream-'+streamName).ready(() => {
      let playerElement = document.getElementById('audio-player-' + streamName);

      this.startPlayer(streamName, playerElement);

      if (this.audioContext) {
        let audioElementSource = this.audioContext.createMediaElementSource(playerElement);

        let analyser = this.audioContext.createAnalyser();
        analyser.smoothingTimeConstant = 0.5;
        analyser.fftSize = 512; // the total samples are half the fft size.
        audioElementSource.connect(analyser);

        let soundSource = this.resonanceScene.createSource();
        let position = this.randomPosition(this.sceneDimensions.width, this.sceneDimensions.height, this.sceneDimensions.depth);
        soundSource.setPosition(position.x, 0, position.z);
        analyser.connect(soundSource.input);

        let draggableElement = this.addDraggable(streamName, position);
        $('.draggable-parent').append(draggableElement);

        streamData.setProperties({
          name: streamName,
          audioElementSource: audioElementSource,
          analyser: analyser,
          soundSource: soundSource,
          position: position,
          draggableElement: draggableElement
        });

        this.drawVU(analyser, draggableElement, 0);
      }
    });
  },
  startPlayer(stream, playerElement) {
    let player = dashjs.MediaPlayer().create();
    player.getDebug().setLogToBrowserConsole(ENV.APP.MEDIA_PLAYER_DEBUG);
    player.on(dashjs.MediaPlayer.events.ERROR, payload => {
      // console.error(payload);
      if (payload.error === 'capability' && payload.event === 'mediasource') {
        this.mediaSourceSupported = false;
      }
    }, this);

    if (this.mediaSourceSupported) {
      player.initialize(playerElement);
      player.attachSource('https://audio.crimeisdown.com/streaming/dash/' + stream + '/');
    } else {
      playerElement.src = 'https://audio.crimeisdown.com/streaming/hls/' + stream + '/index.m3u8';
      // console.error('Sorry, your browser does not support our live streaming functionality.');
    }
  },
  removeStream(streamName) {
    let streamData = this.get('enabledStreams').findBy('name', streamName);
    streamData.draggableElement.remove();
    this.get('enabledStreams').removeObject(streamData);
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
      y: randomAxisPosition(height),
      z: randomAxisPosition(depth)
    };
  },
  roomPositionToDragPosition(position) {
    return {
      dragX: (position.x + this.sceneDimensions.width/2) * this.dragScale - 24,
      dragY: (position.z + this.sceneDimensions.depth/2) * this.dragScale - 8,
    };
  },
  dragPositionToRoomPosition(x, y) {
    return {
      x: ((x+24) / this.dragScale) - this.sceneDimensions.width/2,
      y: 0,
      z: ((y+8) / this.dragScale) - this.sceneDimensions.depth/2
    };
  }
});
