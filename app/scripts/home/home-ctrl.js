'use strict';

angular.module('crimeIsDown')
  .controller('HomeCtrl', function ($scope, $location, $anchorScroll) {
    $scope.scrollTo = function(id) {
      $location.hash(id);
      $anchorScroll();
    };
    // $('.header-nav-toggle').click(function () {
    //     $('body').toggleClass('nav-out');
    // });

    // $('.header-nav a').click(function () {
    //     $('body').removeClass('nav-out');
    // });
  });
