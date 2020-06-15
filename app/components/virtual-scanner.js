/*global MediaElementPlayer, mejs*/

import Component from '@glimmer/component';
import EmberObject from '@ember/object';
import { action } from '@ember/object';
import { bind } from '@ember/runloop';
import fetch from 'fetch';
import $ from 'jquery';

export default class VirtualScanner extends Component {
  dragScale = 50;

  constructor() {
    super(...arguments);
    this.streams = [];
    this.enabledStreams = [];
    this.nameDescMappings = {
      zone1:          "CPD Zone 1 (016/017)",
      zone2:          "CPD Zone 2 (019)",
      zone3:          "CPD Zone 3 (012/014)",
      zone4:          "CPD Zone 4 (001/018)",
      zone5:          "CPD Zone 5 (002)",
      zone6:          "CPD Zone 6 (007/008)",
      zone7:          "CPD Zone 7 (003)",
      zone8:          "CPD Zone 8 (004/006)",
      zone9:          "CPD Zone 9 (005/022)",
      zone10:         "CPD Zone 10 (010/011)",
      zone11:         "CPD Zone 11 (020/024)",
      zone12:         "CPD Zone 12 (015/025)",
      zone13:         "CPD Zone 13 (009)",
      citywide1:      "CPD Citywide 1",
      citywide2:      "CPD Citywide 2",
      citywide5:      "CPD Citywide 5",
      citywide6:      "CPD Citywide 6",
      fire_main:      "CFD Fire North",
      fire_englewood: "CFD Fire South",
      ems_main:       "CFD EMS North",
      ems_englewood:  "CFD EMS South"
    };

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
        if (streamData.soundSource) {
          streamData.soundSource.setPosition(roomPos.x, roomPos.y, roomPos.z);
        } else if (streamData.panner) {
          streamData.panner.pan.setValueAtTime(roomPos.x/2, this.audioContext.currentTime);
        }
      }
    };
    fetch('https://audio.crimeisdown.com/streaming/stat')
      .then(response => response.text())
      .then(xml => (new window.DOMParser()).parseFromString(xml, 'text/xml'))
      .then(data => {
        let nodes = data.querySelectorAll('live stream');
        // we would use forEach but it does not work on Safari <10
        for (let i = 0; i < nodes.length; i++) {
          let node = nodes[i];
          if (node.querySelector('active')) {
            let streamName = node.querySelector('name').textContent;
            let streamDesc = streamName in this.nameDescMappings ? this.nameDescMappings[streamName] : streamName;
            this.streams.pushObject({name: streamName, desc: streamDesc});
          }
        }
        this.streams.sort((a, b) => a.desc.localeCompare(b.desc, 'en', {numeric: true}));
      });

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
  }

  @action
  changeStreams(event) {
    const target = event.target;
    if (typeof this.audioContext === 'undefined') {
      if (!(window.AudioContext || window.webkitAudioContext)) {
        alert('Sorry, your browser does not support our own audio streaming. Please check out some of the other streaming links on this page, or switch to a browser like Chrome that is supported.');
        return;
      }

      // Instantiate the context on user interaction
      this.audioContext = new (window.AudioContext || window.webkitAudioContext);
      this.mediaSourceSupported = (('MediaSource' in window) || ('WebKitMediaSource' in window)) && !mejs.Features.isiOS;
      this.setupResonanceScene();
    }

    if (target.checked) {
      this.addStream(target.value);
    } else {
      this.removeStream(target.value);
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
    this.sceneDimensions = {
      width: 4, height: 4, depth: 4,
    };
    this.sceneMaterials = {
      left: 'uniform', right: 'uniform',
      up: 'transparent', down: 'transparent',
      front: 'uniform', back: 'uniform',
    };

    let resonanceAudioSupported = this.mediaSourceSupported;
    if (resonanceAudioSupported) {
      this.resonanceScene = new window.ResonanceAudio(this.audioContext, {
        ambisonicOrder: 1,
      });

      // Commented out b/c of https://github.com/resonance-audio/resonance-audio-web-sdk/issues/16
      // this.resonanceScene.setRoomProperties(this.sceneDimensions, this.sceneMaterials);
      this.resonanceScene.output.connect(this.audioContext.destination);
    }
  }

  addStream(streamName) {
    let streamDesc = streamName in this.nameDescMappings ? this.nameDescMappings[streamName] : streamName;
    let streamData = EmberObject.create({name: streamName, desc: streamDesc});
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

      streamData.setProperties({
        position: position,
        draggableElement: draggableElement
      });

      player.media.addEventListener('canplay', bind(this, () => {
        // Get the real media element
        playerElement = player.media.renderer;
        let audioElementSource;
        try {
          audioElementSource = this.audioContext.createMediaElementSource(playerElement);
        } catch (e) {
          // We already went thru this, stop here
          return;
        }
        streamData.set('audioElementSource', audioElementSource);

        let analyser = this.audioContext.createAnalyser();
        analyser.smoothingTimeConstant = 1;
        analyser.fftSize = 256; // the total samples are half the fft size.
        audioElementSource.connect(analyser);
        streamData.set('analyser', analyser);

        let volume = this.audioContext.createGain();
        player.media.addEventListener('volumechange', () => {
          volume.gain.setValueAtTime(player.getVolume(), this.audioContext.currentTime);
        });
        streamData.analyser.connect(volume);
        streamData.set('volume', volume);

        if (this.resonanceScene) {
          let soundSource = this.resonanceScene.createSource();
          soundSource.setPosition(position.x, 0, position.z);
          volume.connect(soundSource.input);
          streamData.set('soundSource', soundSource);
        } else {
          let panner = this.audioContext.createStereoPanner();
          panner.pan.value = position.x/2;
          volume.connect(panner);
          panner.connect(this.audioContext.destination);
          streamData.set('panner', panner);
        }

        draggableElement.classList.add('draggable'); // Make the element draggable now that we have completed setup

        if (analyser) {
          this.drawVU(analyser, draggableElement, 0);
        }
      }));
    }));
  }

  startPlayer(stream, playerElement) {
    let audioPlayer;
    if (this.mediaSourceSupported) {
      audioPlayer = new MediaElementPlayer(playerElement, {
        pluginPath: "https://cdn.jsdelivr.net/npm/mediaelement@4.2.12/build/",
        shimScriptAccess: 'always',
        renderers: ['native_dash', 'flash_dash'],
        dash: { path: 'https://cdn.dashjs.org/v3.0.0/dash.all.min.js' },
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
        pluginPath: "https://cdn.jsdelivr.net/npm/mediaelement@4.2.12/build/",
        shimScriptAccess: 'always',
        renderers: ['html5', 'native_hls', 'flash_hls'],
        hls: { path: 'https://cdn.jsdelivr.net/npm/hls.js@0.12.4' },
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
  }

  removeStream(streamName) {
    let streamData = this.enabledStreams.findBy('name', streamName);
    if (streamData.soundSource) streamData.soundSource.input.disconnect();
    if (streamData.panner) streamData.panner.disconnect();
    if (streamData.volume) streamData.volume.disconnect();
    if (streamData.analyser) streamData.analyser.disconnect();
    if (streamData.audioElementSource) streamData.audioElementSource.disconnect();
    streamData.draggableElement.remove();
    this.enabledStreams.removeObject(streamData);
  }

  addDraggable(streamName, roomPosition) {
    let draggableElement = document.getElementById('drag-' + streamName);
    let dragPos = this.roomPositionToDragPosition(roomPosition);
    draggableElement.style.transform = 'translate('+dragPos.dragX+'px, '+dragPos.dragY+'px)';
    draggableElement.setAttribute('data-x', dragPos.dragX);
    draggableElement.setAttribute('data-y', dragPos.dragY);
    return draggableElement;
  }

  drawVU(analyser, element, lastVal) {
    let array = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(array);

    let max = 0;
    for (let i = 0; i < array.length; i++) {
      max = Math.max(max, Math.abs(array[i] - 128));
    }

    let val = Math.round(max * 16);

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
      let max = len/2;
      let min = -len/2;
      return (Math.random() * (max - min) + min) * 0.9;
    }
    return {
      x: randomAxisPosition(width),
      y: 0,
      z: randomAxisPosition(depth)
    };
  }

  roomPositionToDragPosition(position) {
    return {
      dragX: (position.x + this.sceneDimensions.width/2) * this.dragScale,
      dragY: (position.z + this.sceneDimensions.depth/2) * this.dragScale,
    };
  }

  dragPositionToRoomPosition(x, y) {
    let maxWidth = this.sceneDimensions.width/2;
    let maxDepth = this.sceneDimensions.depth/2;
    return {
      x: Math.min(maxWidth, Math.max(-maxWidth, (x / this.dragScale) - maxWidth)),
      y: 0,
      z: Math.min(maxDepth, Math.max(-maxDepth, (y / this.dragScale) - maxDepth))
    };
  }
}
