'use strict';

angular.module('crimeisdown')
  .controller('MapCtrl', function ($analytics, $scope, $modal, mapUtils) {
    // this should not be done
    String.prototype.toProperCase = function () {
      return this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
    };

    $scope.map = mapUtils.createMap(document.getElementById('map-canvas'));
    var layers = mapUtils.loadLayers($scope.map);
    $scope.feeds = mapUtils.loadOnlineStreams();
    mapUtils.loadFireStations();
    mapUtils.loadTraumaCenters();
    $scope.location = {
      meta: {formattedAddress: '', latitude: '', longitude: '', neighborhood: '', communityArea: ''},
      police: {beat: '', zone: '', district: '', area: ''},
      fire: {nearestEngine: '', nearestAmbo: '', fireDistrict: '', emsDistrict: '', battalion: '', channel: ''},
      ems: {nearestTraumaAdult: '', nearestTraumaPed: ''},
      stats: {population: '', homicides: '', shootings: '', income: ''}
    };
    $scope.layers = {
      communityAreas: false,
      neighborhoods: false,
      policeDistricts: true,
      policeBeats: false,
      traffic: false,
      transit: false
    };

    $scope.lookupAddress = function () {
      $analytics.eventTrack('Looks up address', {category: 'Tools', label: $scope.address});
      $scope.location = mapUtils.lookupAddress($scope.address);
      setTimeout(function () {
        $scope.$digest();
      }, 500);
    };

    $scope.toggleLayer = function (layer) {
      layers[layer].setMap($scope.layers[layer] ? $scope.map : null);
    };

    var modalInstance;

    $scope.openModal = function () {
      modalInstance = $modal.open({
        animation: $scope.animationsEnabled,
        templateUrl: 'onlinestreams.html',
        controller: 'MapCtrl',
        resolve: {
          feeds: function () {
            return $scope.feeds;
          }
        }
      });
    };

    $scope.closeModal = function () {
      modalInstance.close();
    };

  });
