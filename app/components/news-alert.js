import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { run } from '@ember/runloop';
import $ from 'jquery';

export default class NewsAlert extends Component {
  @tracked
  hasSeenAlert = true;

  constructor() {
    super(...arguments);

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
