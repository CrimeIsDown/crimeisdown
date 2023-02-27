import Model, { attr } from '@ember-data/model';

export default class TranscriptSubscriptionModel extends Model {
  @attr name;
  @attr keywords;
  @attr topic;
  @attr notification_channels;

  get keywordsString() {
    let keywords = this.keywords;
    if (typeof this.keywords === 'string') {
      try {
        keywords = JSON.parse(this.keywords);
      } catch {
        // Do nothing
      }
    }
    return Array.isArray(keywords) ? keywords.join('\n') : keywords;
  }

  get topics() {
    return this.topic.split('|');
  }
}
