import Ember from 'ember';
import fetch from 'fetch';

export default Ember.Component.extend({
  streams: [],
  enabledStreams: [],
  init() {
    this._super(...arguments);
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
    this.set('audioContext', new (window.AudioContext || window.webkitAudioContext));

    this.set('resonanceScene', new window.ResonanceAudio(this.get('audioContext'), {
      ambisonicOrder: 1,
    }));
    let dimensions = {
      width: 5, height: 3, depth: 5,
    };
    this.set('sceneDimensions', dimensions);
    this.set('possiblePositions', [{
      x: -dimensions.width,
      y: dimensions.height,
      z: -dimensions.depth
    }, {
      x: dimensions.width,
      y: dimensions.height,
      z: -dimensions.depth
    }, {
      x: -dimensions.width,
      y: dimensions.height,
      z: dimensions.depth
    }, {
      x: dimensions.width,
      y: dimensions.height,
      z: dimensions.depth
    }, {
      x: -dimensions.width,
      y: -dimensions.height,
      z: -dimensions.depth
    }, {
      x: dimensions.width,
      y: -dimensions.height,
      z: -dimensions.depth
    }, {
      x: -dimensions.width,
      y: -dimensions.height,
      z: dimensions.depth
    }, {
      x: dimensions.width,
      y: -dimensions.height,
      z: dimensions.depth
    }]);
    this.set('sceneMaterials', {
      left: 'concrete-block-painted', right: 'concrete-block-painted',
      up: 'wood-ceiling', down: 'wood-panel',
      front: 'concrete-block-painted', back: 'concrete-block-painted',
    });
    this.get('resonanceScene').setRoomProperties(this.get('sceneDimensions'), this.get('sceneMaterials'));
    this.get('resonanceScene').output.connect(this.get('audioContext').destination);
  },
  actions: {
    changeStreams(target) {
      if (target.checked) {
        this.get('enabledStreams').pushObject(target.value);

        setTimeout(() => {
          let audioElementSource = this.get('audioContext').createMediaElementSource(document.getElementById('audio-player-'+target.value));
          let soundSource = this.get('resonanceScene').createSource();
          let position = this.get('possiblePositions')[Math.floor(Math.random() * this.get('possiblePositions').length)];
          soundSource.setPosition(position.x, position.y, position.z);
          console.log(target.value);
          console.log(position);
          audioElementSource.connect(soundSource.input);
        }, 500);
      } else {
        this.get('enabledStreams').removeObject(target.value);
      }
    }
  }
});
