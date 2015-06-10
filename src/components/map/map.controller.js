'use strict';

angular.module('crimeisdown')
  .controller('MapCtrl', function ($scope, $http) {
    // this should not be done
    String.prototype.toProperCase = function () {
      return this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
    };

    $scope.map = null;
    $scope.location = {
      meta: {formatted_address: '', latitude: '', longitude: '', neighborhood: '', community_area: ''},
      police: {beat: '', zone: '', district: '', area: ''},
      fire: {nearest_station: '', district: '', channel: ''},
      stats: {population: '', homicides: '', shootings: '', income: ''}
    };

    $scope.polyDesc = '';

    initializeMap();

    $scope.lookupAddress = function () {
      geocoder.geocode({'address': $scope.address, bounds: chicago}, function (results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
          $scope.location.meta.formatted_address = results[0].formatted_address;
          $scope.location.meta.latitude = results[0].geometry.location.lat().toFixed(6);
          $scope.location.meta.longitude = results[0].geometry.location.lng().toFixed(6);
          $scope.map.setCenter(results[0].geometry.location);
          var marker = new google.maps.Marker({
              map: $scope.map,
              position: results[0].geometry.location
          });
          $scope.map.setCenter(marker.position);
          $scope.map.setZoom(15);
        } else {
          alert("Geocode was not successful for the following reason: " + status);
        }
      });
    };


    function initializeMap () {
      var mapOptions = {
        center: {lat: 41.8369, lng: -87.6847},
        zoom: 10
      };
      $scope.map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);

      var geocoder = new google.maps.Geocoder();
      var chicago = new google.maps.Circle({center: mapOptions.center, radius: 50000}).getBounds()

      var communityAreasLayer = new google.maps.Data();
      var neighborhoodsLayer = new google.maps.Data();
      var policeDistrictsLayer = new google.maps.Data();

      communityAreasLayer.setStyle({
        fillOpacity: 0.0,
        strokeColor: '#333',
        strokeWeight: 2
      });
      communityAreasLayer.addListener('click', function (event) {
        var result = event.feature.getProperty('COMMUNITY').toProperCase();
        $scope.$apply(function () {
          $scope.location.meta.community_area = result;
        });
      });
      $http.get('assets/data/community_areas.json')
        .then(function (res) {
          var json = new GeoJSON(res.data);
          json.forEach(function (value) {
            console.log(value[0]);
            var feature = new google.maps.Data.Feature();
            feature.setGeometry(value[0]);
            communityAreasLayer.add(feature);
          });
        });
      setTimeout(function () {
        communityAreasLayer.forEach(function (feature) {
          console.log(feature);
          var point = new google.maps.LatLng(41.888872, -87.627583);
          if (google.maps.geometry.poly.containsLocation(point, feature.getGeometry())) {
            console.log('found it!');
            console.log(feature);
          }
        });
      }, 5000);



      neighborhoodsLayer.loadGeoJson('assets/data/neighborhoods.json');
      neighborhoodsLayer.setStyle({
        fillOpacity: 0.0,
        strokeColor: '#CCC',
        strokeWeight: 1
      });
      neighborhoodsLayer.addListener('click', function (event) {
        var result = event.feature.getProperty('PRI_NEIGH').toProperCase() + ' / ' + event.feature.getProperty('SEC_NEIGH').toProperCase();
        $scope.$apply(function () {
          $scope.location.meta.neighborhood = result;
        });
      });

      policeDistrictsLayer.loadGeoJson('assets/data/police_districts.json');
      policeDistrictsLayer.setStyle({
        fillOpacity: 0.0,
        strokeColor: 'blue',
        strokeWeight: 3
      });
      policeDistrictsLayer.addListener('click', function (event) {
        var result = event.feature.getProperty('DIST_LABEL').toLowerCase();
        $scope.$apply(function () {
          $scope.location.police.district = result;
        });
      });

      communityAreasLayer.setMap($scope.map);
      neighborhoodsLayer.setMap($scope.map);
      policeDistrictsLayer.setMap($scope.map);


    }

  });
