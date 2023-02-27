import { module, test } from 'qunit';

import { setupTest } from 'crimeisdown/tests/helpers';

module('Unit | Model | transcript subscription', function (hooks) {
  setupTest(hooks);

  // Replace this with your real tests.
  test('it exists', function (assert) {
    let store = this.owner.lookup('service:store');
    let model = store.createRecord('transcript-subscription', {});
    assert.ok(model);
  });
});
