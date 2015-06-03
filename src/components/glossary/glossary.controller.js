'use strict';

angular.module('crimeisdown')
  .controller('GlossaryCtrl', function ($scope, $http) {
    var radioIds = [];
    var ucrCodes;

    $http.jsonp("https://script.google.com/macros/s/AKfycbwdMu3lgUaMPqA-ESlmhD12Yo6Jz78LlCM8cMQXW7Cm4O94sAA/exec?id=1kiv-ELXw9Z-LcfZ87dFlBDN4GMdjZv_Iz5DSxTH_Cd4&sheet=Radio%20IDs&callback=JSON_CALLBACK")
      .success(function (data) {
        radioIds = data["Radio IDs"];
      })
      .error(function (data) {
        console.error('Could not fetch radio ID list');
      });

    $http.get("assets/data/ucr_codes.json")
      .success(function (data) {
        ucrCodes = data;
      })
      .error(function (data) {
        ucrCodes = {};
        console.error('Could not fetch UCR code list');
      });

    $scope.radio = {};

    $scope.lookupRadioId = function () {
      var matches = [];
      radioIds.forEach(function (row, index) {
        if ($scope.radioId.match('^' + row.ID_Number + '[A-Za-z]?$')) {
          matches.push(row);
        }
      });
      $('#radioid-results td').empty();
      if (matches.length > 0) {
        matches.forEach(function (match, index) {
          if (match.Agency.length) $scope.radio.agency = match.Agency;
          if (match.Level_1.length) $scope.radio.level1 = match.Level_1;
          if (match.Level_2.length) $scope.radio.level2 = match.Level_2;
          if (match.Level_3.length) $scope.radio.level3 = match.Level_3;
          if (match.Level_4.length) {
            if (match.Level_4 == 'Beat Car') $scope.radio.level4 = 'Beat #' + $scope.radioId.match(/\d+/)[0];
            else $scope.radio.level4 = match.Level_4;
          }
          // match.ID_Number
        });
      } else $scope.radio = {agency: 'N/A', level1: 'N/A', level2: 'N/A', level3: 'N/A', level4: 'N/A'};
    };

    $scope.ucr = {};

    $scope.lookupUCR = function () {
      var code = $scope.ucrCode.toUpperCase().replace(/-/g, '');
      if (ucrCodes[code]) {
        $scope.ucr = ucrCodes[code];
        $scope.ucrCode = code;
      } else $scope.ucr = {primary_desc: 'Not Found', secondary_desc: 'Not Found', index_code: 'N/A'};
    };
  });
