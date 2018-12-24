import Component from '@ember/component';

export default Component.extend({
  init() {
    this._super(...arguments);
    this.localStorageKey = 'saw-alert-20181223';
    this.set('hasSeenAlert', localStorage.getItem(this.localStorageKey) !== null);
  },
  didInsertElement() {
    if (!this.hasSeenAlert) {
      $('#news-alert').on('closed.bs.alert', function () {
        localStorage.setItem(this.localStorageKey, true);
      });
    }
  }
});
