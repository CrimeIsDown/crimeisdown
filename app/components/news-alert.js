import Component from '@ember/component';
import { run } from '@ember/runloop';
import $ from 'jquery';

export default Component.extend({
  init() {
    this._super(...arguments);
    this.set('hasSeenAlert', true);
    /*try {
      this.set('hasSeenAlert', localStorage.getItem('saw-alert-20181223') !== null);
    } catch (e) {
      return false;
    }*/
  },
  didInsertElement() {
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
});
