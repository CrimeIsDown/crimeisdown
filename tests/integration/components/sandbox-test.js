import { module, test } from 'qunit';
import { setupRenderingTest } from 'crimeisdown/tests/helpers';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | Component | sandbox', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function (assert) {
    // Set any properties with this.set('myProperty', 'value');
    // Handle any actions with this.set('myAction', function(val) { ... });

    await render(hbs`<Sandbox />`);

    assert.dom().hasText('');

    // Template block usage:
    await render(hbs`
      <Sandbox>
        template block text
      </Sandbox>
    `);

    assert.dom().hasText('template block text');
  });
});
