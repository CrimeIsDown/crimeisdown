import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class Alert extends Component {
  @tracked
  hasSeenAlert = false;

  constructor() {
    super(...arguments);
    try {
      this.hasSeenAlert = localStorage.getItem(`alert-${this.args.key}`)
        ? true
        : false;
    } catch {
      // No localStorage
    }
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
