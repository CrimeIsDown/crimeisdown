import { module, test } from 'qunit';
import { setupTest } from 'crimeisdown/tests/helpers';

module('Unit | Route | notifications', function (hooks) {
  setupTest(hooks);

  test('it exists', function (assert) {
    let route = this.owner.lookup('route:notifications');
    assert.ok(route);
  });
});
