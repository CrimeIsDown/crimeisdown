'use strict';

angular.module('crimeisdown')
  .controller('MainCtrl', function ($scope, $timeout) {
    try {
      $timeout = twttr.widgets.load();
    } catch (e) {}
    $scope.alerts = [
      { type: 'info', msg: "<strong>Welcome to the new CrimeIsDown.com!</strong> There have been a lot of changes to the site and we're still improving it. Email Eric (<a href='mailto:eric@crimeisdown.com'>eric@crimeisdown.com</a>) with your feedback/suggestions. Any <a href='https://www.paypal.com/cgi-bin/webscr?cmd=_donations&amp;business=4SHEMCHJPV8KY&amp;lc=US&amp;item_name=CrimeIsDown%2ecom&amp;currency_code=USD&amp;bn=PP%2dDonationsBF%3abtn_donate_LG%2egif%3aNonHosted' target='_blank'>donations</a> would be appreciated so we can pay for additional hosting costs." }
    ];
    $scope.closeAlert = function(index) {
      $scope.alerts.splice(index, 1);
    };
  });
