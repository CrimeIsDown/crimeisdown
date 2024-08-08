import { module, test } from 'qunit';
import { setupRenderingTest } from 'crimeisdown/tests/helpers';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | Component | icecast-player', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function (assert) {
    // Set any properties with this.set('myProperty', 'value');
    // Handle any actions with this.set('myAction', function(val) { ... });

    await render(hbs`<IcecastPlayer />`);

    assert.dom().hasText('');

    // Template block usage:
    await render(hbs`
      <IcecastPlayer>
        template block text
      </IcecastPlayer>
    `);

    assert.dom().hasText('template block text');
  });
});
