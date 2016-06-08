import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('virtual-scanner', 'Integration | Component | virtual scanner', {
  integration: true
});

test('it renders', function(assert) {
  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });

  this.render(hbs`{{virtual-scanner}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:
  this.render(hbs`
    {{#virtual-scanner}}
      template block text
    {{/virtual-scanner}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
