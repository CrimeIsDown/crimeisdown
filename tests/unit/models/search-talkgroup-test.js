import { module, test } from 'qunit';

import { setupTest } from 'crimeisdown/tests/helpers';

module('Unit | Model | search talkgroup', function (hooks) {
  setupTest(hooks);

  // Replace this with your real tests.
  test('it exists', function (assert) {
    let store = this.owner.lookup('service:store');
    let model = store.createRecord('search-talkgroup', {});
    assert.ok(model);
  });
});
