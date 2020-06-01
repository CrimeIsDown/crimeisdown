import Component from '@glimmer/component';
import { run } from '@ember/runloop';
import $ from 'jquery';

export default class NewsAlert extends Component {
  hasSeenAlert = true;

  constructor() {
    super(...arguments);
    /*try {
      this.hasSeenAlert = localStorage.getItem('saw-alert-20181223') !== null;
    } catch (e) {
      return false;
    }*/

    if (!this.hasSeenAlert) {
      $('#news-alert').on('closed.bs.alert', () => {
        run(() => {
          try {
          localStorage.setItem('saw-alert-20181223', true);
          } catch (e) {
            return false;
          }
        });
      });
    }
  }
}
