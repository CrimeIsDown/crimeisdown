import Model, { attr } from '@ember-data/model';

export default class SearchTalkgroupModel extends Model {
  @attr group;
  @attr talkgroups;
}
