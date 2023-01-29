import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | search radioids', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function (assert) {
    // Set any properties with this.set('myProperty', 'value');
    // Handle any actions with this.on('myAction', function(val) { ... });

    await render(hbs`{{search-radioids}}`);

    assert.dom('*').hasText('');

    // Template block usage:
    await render(hbs`
      <SearchRadioids>
        template block text
      </SearchRadioids>
    `);

    assert.dom('*').hasText('template block text');
  });
});
