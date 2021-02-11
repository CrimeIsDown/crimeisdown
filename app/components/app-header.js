import LinkComponent from '@ember/routing/link-component';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action, set } from '@ember/object';

LinkComponent.reopen({
  attributeBindings: ['data-toggle', 'data-target'],
});

export default class AppHeader extends Component {
  @tracked playmusic = false;

  @action
  togglemusic() {
    set(this, 'playmusic', !this.playmusic);
    let audioElem = document.getElementById('copstheme');
    if (this.playmusic) {
      audioElem.volume = 0.3;
      audioElem.play();
    } else {
      audioElem.pause();
    }
  }
}
