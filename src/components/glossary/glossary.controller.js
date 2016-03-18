'use strict';

angular.module('crimeisdown')
  .controller('GlossaryCtrl', function ($analytics, $scope, $http) {
    var radioIds = [];
    var ucrCodes;

    $http.jsonp('https://script.google.com/macros/s/AKfycbwdMu3lgUaMPqA-ESlmhD12Yo6Jz78LlCM8cMQXW7Cm4O94sAA/exec?id=1kiv-ELXw9Z-LcfZ87dFlBDN4GMdjZv_Iz5DSxTH_Cd4&sheet=Radio%20IDs&callback=JSON_CALLBACK')
      .success(function (data) {
        radioIds = data['Radio IDs'];
      })
      .error(function (data) {
        console.error('Could not fetch radio ID list');
      });

    $http.jsonp('https://script.google.com/macros/s/AKfycbwdMu3lgUaMPqA-ESlmhD12Yo6Jz78LlCM8cMQXW7Cm4O94sAA/exec?id=1Zzx6UXOYL5BXXYTO_PanTESGS5nHLHDMxBi7u0k1ppg&sheet=UCR%20Codes&callback=JSON_CALLBACK')
      .success(function (data) {
        ucrCodes = data['UCR Codes'];
      })
      .error(function (data) {
        ucrCodes = {};
        console.error('Could not fetch UCR code list');
      });

    $scope.radio = {};

    $scope.lookupRadioId = function () {
      $analytics.eventTrack('Searches radio ID list', {category: 'Tools', label: $scope.radioId});
      var matches = [];
      radioIds.forEach(function (row, index) {
        if ($scope.radioId.match('^' + row.ID_Number + '$')) {
          matches.push(row);
        }
      });
      $('#radioid-results td').empty();
      if (matches.length > 0) {
        $scope.radio = {agency: '', level1: '', level2: '', level3: '', level4: ''};
        matches.forEach(function (match, index) {
          if (match.Agency.length) {
            $scope.radio.agency = match.Agency;
          }
          if (match.Level_1.length) {
            $scope.radio.level1 = match.Level_1;
          }
          if (match.Level_2.length) {
            $scope.radio.level2 = match.Level_2;
          }
          if (match.Level_3.length) {
            $scope.radio.level3 = match.Level_3;
          }
          if (match.Level_4.length) {
            if (match.Level_4 === 'Beat Car') {
              $scope.radio.level4 = 'Beat #' + $scope.radioId.match(/\d+/)[0];
            } else {
              $scope.radio.level4 = match.Level_4;
            }
          }
        });
      } else {
        $scope.radio = {agency: 'N/A', level1: 'N/A', level2: 'N/A', level3: 'N/A', level4: 'N/A'};
      }
    };

    $scope.ucr = {};

    $scope.lookupUCR = function () {
      $analytics.eventTrack('Searches UCR list', {category: 'Tools', label: $scope.ucrCode});
      $scope.ucr = {primaryDesc: 'Not Found', secondaryDesc: 'Not Found', indexCode: 'N/A'};
      var code = transformUCR($scope.ucrCode);
      ucrCodes.forEach(function (row, index) {
        if (code == transformUCR(row.ucrCode)) {
          $scope.ucr = row;
          $scope.ucrCode = code;
          return;
        }
      });
      function transformUCR(code) {
        return code.toUpperCase().replace(/-/g, '');
      }
    };
  });
