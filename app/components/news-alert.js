import Component from '@ember/component';

export default Component.extend({
  init() {
    this._super(...arguments);
    this.set('hasSeenAlert', localStorage.getItem('saw-alert-20181223') !== null);
  },
  didInsertElement() {
    if (!this.hasSeenAlert) {
      $('#news-alert').on('closed.bs.alert', function () {
        localStorage.setItem('saw-alert-20181223', true);
      });
    }
  }
});
