import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | address lookup', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function (assert) {
    // Set any properties with this.set('myProperty', 'value');
    // Handle any actions with this.on('myAction', function(val) { ... });

    await render(hbs`{{address-lookup}}`);

    assert.dom('*').hasText('');

    // Template block usage:
    await render(hbs`
      <AddressLookup>
        template block text
      </AddressLookup>
    `);

    assert.dom('*').hasText('template block text');
  });
});
