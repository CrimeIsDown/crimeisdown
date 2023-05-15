import { module, test } from 'qunit';
import { setupTest } from 'crimeisdown/tests/helpers';

module('Unit | Route | map-transcripts', function (hooks) {
  setupTest(hooks);

  test('it exists', function (assert) {
    let route = this.owner.lookup('route:map-transcripts');
    assert.ok(route);
  });
});
