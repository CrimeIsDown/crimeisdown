'use strict';

angular.module('crimeisdown')
  .controller('MapCtrl', function ($scope) {
    $scope.lookupAddress = function () {
      console.log('triggered');
    };
  });
