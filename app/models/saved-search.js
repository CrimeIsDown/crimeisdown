import Model, { attr } from '@ember-data/model';

export default class SavedSearchModel extends Model {
  @attr name;
  @attr url;
  @attr is_global;
}
