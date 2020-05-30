import Component from '@glimmer/component';
import { run } from '@ember/runloop';
import $ from 'jquery';

export default class NewsAlert extends Component {
  hasSeenAlert = false;

  constructor() {
    super(...arguments);
    try {
      this.hasSeenAlert = localStorage.getItem('saw-alert-20200530') !== null;
    } catch (e) {
      return false;
    }

    if (!this.hasSeenAlert) {
      $('#news-alert').on('closed.bs.alert', () => {
        run(() => {
          try {
          localStorage.setItem('saw-alert-20200530', true);
          } catch (e) {
            return false;
          }
        });
      });
    }
  }
}
