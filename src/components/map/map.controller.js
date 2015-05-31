'use strict';

angular.module('crimeisdown')
  .controller('MapCtrl', function ($scope) {
    var mapOptions = {
      center: {lat: 41.8369, lng: -87.6847},
      zoom: 10
    };
    $scope.map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
    var geocoder = new google.maps.Geocoder();
    var chicago = new google.maps.Circle({center: mapOptions.center, radius: 50000}).getBounds()

    $scope.lookupAddress = function () {
      geocoder.geocode({'address': $scope.address, bounds: chicago}, function (results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
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
  });
