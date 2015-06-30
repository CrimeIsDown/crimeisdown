'use strict';

angular.module('crimeisdown')
  .controller('StaticCtrl', function ($timeout) {
    try {
      $timeout = twttr.widgets.load();
    } catch (e) {}
  });
