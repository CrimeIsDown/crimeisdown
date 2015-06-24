'use strict';

angular.module('crimeisdown')
  .controller('MainCtrl', function ($scope) {
    $scope.alerts = [
      { type: 'info', msg: "<strong>Welcome to the new CrimeIsDown.com!</strong> We've revamped the site to focus on our scanner tools, as well as added a couple new features. More updates to come!" }
    ];
    $scope.closeAlert = function(index) {
      $scope.alerts.splice(index, 1);
    };
  });
