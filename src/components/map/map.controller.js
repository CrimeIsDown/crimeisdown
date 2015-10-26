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
    $scope.location = {
      meta: {formatted_address: '', latitude: '', longitude: '', neighborhood: '', community_area: ''},
      police: {beat: '', zone: '', district: '', area: ''},
      fire: {nearest_engine: '', nearest_ambo: '', fire_district: '', ems_district: '', battalion: '', channel: ''},
      stats: {population: '', homicides: '', shootings: '', income: ''}
    };
    $scope.layers = {
      community_areas: false,
      neighborhoods: false,
      police_districts: true,
      police_beats: false,
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
    }

  });
