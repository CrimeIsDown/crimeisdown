import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | virtual scanner', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function (assert) {
    // Set any properties with this.set('myProperty', 'value');
    // Handle any actions with this.on('myAction', function(val) { ... });

    await render(hbs`{{virtual-scanner}}`);

    assert.dom('*').hasText('');

    // Template block usage:
    await render(hbs`
      <VirtualScanner>
        template block text
      </VirtualScanner>
    `);

    assert.dom('*').hasText('template block text');
  });
});
