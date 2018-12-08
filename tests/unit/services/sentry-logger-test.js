import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Service | sentry logger', function(hooks) {
  setupTest(hooks);

  // Replace this with your real tests.
  test('it exists', function(assert) {
    let service = this.owner.lookup('service:sentry-logger');
    assert.ok(service);
  });
});
