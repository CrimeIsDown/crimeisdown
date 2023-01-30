import { action } from '@ember/object';
import { service } from '@ember/service';
import Component from '@glimmer/component';

export default class SettingsComponent extends Component {
  @service config;

  @action
  update(event) {
    event.preventDefault();
    const data = new FormData(event.target);
    for (const [key, value] of data.entries()) {
      this.config.set(key, value);
    }
    alert(`Successfully updated:\n${JSON.stringify(this.config.ENV, null, 2)}`);
  }
}
