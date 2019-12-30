import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Route | audio-live', function(hooks) {
  setupTest(hooks);

  test('it exists', function(assert) {
    let route = this.owner.lookup('route:audio-live');
    assert.ok(route);
  });
});
