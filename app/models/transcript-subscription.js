import Model, { attr } from '@ember-data/model';

export default class TranscriptSubscriptionModel extends Model {
  @attr name;
  @attr keywords;
  @attr ignore_keywords;
  @attr location;
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

  get ignoreKeywordsString() {
    let ignore_keywords = this.ignore_keywords;
    if (typeof this.ignore_keywords === 'string') {
      try {
        ignore_keywords = JSON.parse(this.ignore_keywords);
      } catch {
        // Do nothing
      }
    }
    return Array.isArray(ignore_keywords)
      ? ignore_keywords.join('\n')
      : ignore_keywords;
  }

  get topics() {
    return this.topic.split('|');
  }
}
