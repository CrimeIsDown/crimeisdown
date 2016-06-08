import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('search-ucrcodes', 'Integration | Component | search ucrcodes', {
  integration: true
});

test('it renders', function(assert) {
  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });

  this.render(hbs`{{search-ucrcodes}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:
  this.render(hbs`
    {{#search-ucrcodes}}
      template block text
    {{/search-ucrcodes}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
