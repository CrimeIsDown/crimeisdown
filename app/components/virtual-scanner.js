import Component from '@ember/component';
import { set } from '@ember/object';
import EmberObject from '@ember/object';
import fetch from 'fetch';
import $ from 'jquery';

export default Component.extend({
  dragScale: 50,
  init() {
    this._super(...arguments);
    this.streams = [];
    this.enabledStreams = [];
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
        console.log(roomPos);
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

    this.set('audioContext', new (window.AudioContext || window.webkitAudioContext));

    this.set('resonanceScene', new window.ResonanceAudio(this.get('audioContext'), {
      ambisonicOrder: 1,
    }));
    let dimensions = {
      width: 4, height: 4, depth: 4,
    };
    this.set('sceneDimensions', dimensions);
    this.set('sceneMaterials', {
      left: 'uniform', right: 'uniform',
      up: 'transparent', down: 'transparent',
      front: 'uniform', back: 'uniform',
    });
    this.get('resonanceScene').setRoomProperties(this.get('sceneDimensions'), this.get('sceneMaterials'));
    this.get('resonanceScene').output.connect(this.get('audioContext').destination);
  },
  actions: {
    changeStreams(target) {
      if (target.checked) {
        this.addStream(target.value);
      } else {
        this.removeStream(target.value);
      }
    }
  },
  addStream(streamName) {
    let streamData = EmberObject.create({name: streamName});
    this.get('enabledStreams').pushObject(streamData);

    setTimeout(() => {
      let audioElementSource = this.get('audioContext').createMediaElementSource(document.getElementById('audio-player-'+streamName));
      let soundSource = this.get('resonanceScene').createSource();
      let position = this.randomPosition(this.get('sceneDimensions').width, this.get('sceneDimensions').height, this.get('sceneDimensions').depth);
      soundSource.setPosition(position.x, 0, position.z);
      audioElementSource.connect(soundSource.input);
      let draggableElement = document.createElement('i');
      draggableElement.id = 'drag-' + streamName;
      draggableElement.className = 'draggable fa fa-volume-up';
      let dragPos = this.roomPositionToDragPosition(position);
      draggableElement.style = 'transform: translate('+dragPos.dragX+'px, '+dragPos.dragY+'px);';
      draggableElement.title = streamName;
      draggableElement.setAttribute('data-x', dragPos.dragX);
      draggableElement.setAttribute('data-y', dragPos.dragY);
      $('.draggable-parent').append(draggableElement);
      streamData.setProperties({
        name: streamName,
        audioElementSource: audioElementSource,
        soundSource: soundSource,
        position: position,
        draggableElement: draggableElement
      });
    }, 500);
  },
  removeStream(streamName) {
    this.get('enabledStreams').removeObject(this.get('enabledStreams').findBy('name', streamName));
    document.getElementById('drag-' + streamName).remove();
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
