import Ember from 'ember';

Ember.LinkComponent.reopen({
  attributeBindings: ['data-toggle', 'data-target']
});

export default Ember.Component.extend({
});
