import LinkComponent from '@ember/routing/link-component';
import Component from '@ember/component';

LinkComponent.reopen({
  attributeBindings: ['data-toggle', 'data-target']
});

export default Component.extend({
  playmusic: false,

  actions: {
    togglemusic: function () {
      this.set('playmusic', !this.playmusic);
      let audioElem = document.getElementById('copstheme');
      if (this.playmusic) {
        audioElem.volume = 0.3;
        audioElem.play();
      } else {
        audioElem.pause();
      }
    }
  }
});
