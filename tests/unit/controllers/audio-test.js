import { module, test } from 'qunit';
import { setupTest } from 'crimeisdown/tests/helpers';

module('Unit | Controller | audio', function (hooks) {
  setupTest(hooks);

  // TODO: Replace this with your real tests.
  test('it exists', function (assert) {
    let controller = this.owner.lookup('controller:audio');
    assert.ok(controller);
  });
});
