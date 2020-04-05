import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, find } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | app footer', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {

    // Set any properties with this.set('myProperty', 'value');
    // Handle any actions with this.on('myAction', function(val) { ... });

    await render(hbs`{{app-footer}}`);

    assert.dom('*').hasText('');

    // Template block usage:
    await render(hbs`
      {{#app-footer}}
        template block text
      {{/app-footer}}
    `);

    assert.dom('*').hasText('template block text');
  });
});
