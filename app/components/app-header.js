import LinkComponent from '@ember/routing/link-component';
import Component from '@ember/component';
import { inject as service } from '@ember/service';

LinkComponent.reopen({
  attributeBindings: ['data-toggle', 'data-target']
});

export default Component.extend({
  session: service('session'),
  playmusic: false,

  actions: {
    logout: function() {
      this.session.invalidate().then(function() {
        this.transitionToRoute('login');
      }.bind(this));
    },
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
