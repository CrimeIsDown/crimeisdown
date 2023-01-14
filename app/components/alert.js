import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class Alert extends Component {
  @tracked
  hasSeenAlert = false;

  constructor() {
    super(...arguments);
    this.hasSeenAlert = localStorage.getItem(`alert-${this.args.key}`)
      ? true
      : false;
  }

  @action
  dismiss() {
    try {
      localStorage.setItem(`alert-${this.args.key}`, true);
    } catch (e) {
      return false;
    }
  }
}
