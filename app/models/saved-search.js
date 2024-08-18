import Model, { attr } from '@ember-data/model';
import moment from 'moment-timezone';

export default class SavedSearchModel extends Model {
  @attr user_id;
  @attr name;
  @attr url;
  @attr is_global;

  get latestUrl() {
    const currentIndex = this.url.match(/calls_\d{4}_\d{2}/)[0];
    const latestIndex = 'calls_' + moment.utc().format('YYYY_MM');
    if (currentIndex != latestIndex) {
      return this.url.replaceAll(currentIndex, latestIndex);
    }
    return this.url;
  }
}
