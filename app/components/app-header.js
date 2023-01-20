import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action, set } from '@ember/object';
import { service } from '@ember/service';

export default class AppHeader extends Component {
  @service session;
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
