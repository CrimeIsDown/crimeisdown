'use strict';

angular.module('crimeisdown', ['ngResource', 'ui.router', 'ui.bootstrap'])
  .config(function ($stateProvider, $urlRouterProvider) {
    $stateProvider
      .state('home', {
        url: '/',
        templateUrl: 'app/main/main.html',
        controller: 'MainCtrl'
      })
      .state('about', {
        url: '/about',
        templateUrl: 'app/static/about.html',
        controller: 'StaticCtrl'
      })
      .state('takeAction', {
        url: '/take-action',
        templateUrl: 'app/static/take-action.html',
        controller: 'StaticCtrl'
      })
      .state('gettingStarted', {
        url: '/getting-started',
        templateUrl: 'app/static/getting-started.html',
        controller: 'StaticCtrl'
      })
      .state('ethics', {
        url: '/ethics',
        templateUrl: 'app/static/ethics.html',
        controller: 'StaticCtrl'
      })
      .state('intro', {
        url: '/intro',
        templateUrl: 'app/static/intro.html',
        controller: 'StaticCtrl'
      })
      ;

    $urlRouterProvider.otherwise('/');
  })
;
