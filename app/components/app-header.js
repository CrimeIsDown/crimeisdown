import LinkComponent from '@ember/routing/link-component';
import Component from '@ember/component';

LinkComponent.reopen({
  attributeBindings: ['data-toggle', 'data-target']
});

export default Component.extend({
});
