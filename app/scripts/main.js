'use strict';

$(function onload() {
    $('ul.nav a').filter(function() {
        return this.href == window.location;
    }).parent().addClass('active');

    $('.imgLiquidFill').imgLiquid({ fill: true }); // for backdrop on index page

    $('a[href*=#]:not([href=#])').click(function() {
        if (location.pathname.replace(/^\//,'') === this.pathname.replace(/^\//,'') && location.hostname === this.hostname) {
            var target = $(this.hash);
            target = target.length ? target : $('[name=' + this.hash.slice(1) +']');
            if (target.length) {
                $('html,body').animate({
                    scrollTop: target.offset().top
                }, 1000);
                return false;
            }
        }
    });

    if ($('#tools').length) {
        initializeMap();
        initRadioIds();
    }
});

var geoXml = null;
var map = null;
var geocoder = null;
var toggleState = 1;
var infowindow = null;
var marker = null;

function createPoly(points, colour, width, opacity, fillcolour, fillopacity, bounds, name, description) {
    GLog.write("createPoly(" + colour + "," + width + "<" + opacity + "," + fillcolour + "," + fillopacity + "," + name + "," + description + ")");
    var poly = new GPolygon(points, colour, width, opacity, fillcolour, fillopacity);
    poly.Name = name;
    poly.Description = description;
    map.addOverlay(poly);
    exml.gpolygons.push(poly);
    return poly;
}

function initializeMap() {
    geocoder = new google.maps.Geocoder();
    infowindow = new google.maps.InfoWindow({
        size: new google.maps.Size(200, 100)
    });
    // create the map
    var myOptions = {
        zoom: 10,
        center: new google.maps.LatLng(41.80, -87.6278),
        mapTypeControl: true,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
        },
        navigationControl: true,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [{
            featureType: "poi.medical",
            elementType: "geometry.fill",
            stylers: [{ lightness: -100 }]
        }]
    };
    map = new google.maps.Map(document.getElementById("map-canvas"),
        myOptions);
    geoXml = new geoXML3.parser({
        map: map,
        singleInfoWindow: true,
        infoWindow: infowindow /*, createpolygon: createPoly */
    });
    geoXml.parse('cpd_districts.kml');
    // exml = new EGeoXml({map: map, singleInfoWindow: true, createpolygon: createPoly});
}

function showAddress(address) {
    var contentString = address + "<br>Outside Area";
    geocoder.geocode({
        'address': address+' Chicago'
    }, function (results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            $('#address-results td').text('Loading...');
            var url = "http://boundaries.tribapps.com/1.0/boundary/?contains="+results[0].geometry.location.k+","+results[0].geometry.location.D+"&sets=community-areas,neighborhoods,police-districts,police-beats&format=jsonp&callback=showInfo";
            $.ajax({
                url: url,
                jsonp: "showInfo",
                dataType: "jsonp",
                crossDomain: true
            });
            var point = results[0].geometry.location;
            contentString += "<br>" + point;
            map.setCenter(point);
            if (marker && marker.setMap) marker.setMap(null);
            marker = new google.maps.Marker({
                map: map,
                position: point
            });
            for (var i = 0; i < geoXml.docs[0].gpolygons.length; i++) {
                if (geoXml.docs[0].gpolygons[i].Contains(point)) {
                    contentString = results[0].formatted_address + "<br>" + geoXml.docs[0].placemarks[i].description;
                    contentString += "<br>" + point;
                    $('#address-results #formattedaddress').html(results[0].formatted_address);
                    $('#address-results #policedistrict').html(geoXml.docs[0].placemarks[i].description);
                    break;
                }
            }
            google.maps.event.addListener(marker, 'click', function () {
                infowindow.setContent(contentString);
                infowindow.open(map, marker);
            });
            google.maps.event.trigger(marker, "click");
        } else {
            alert("Geocode was not successful for the following reason: " + status);
        }
    });
}

function showInfo(data) {
    if (data.objects.length) {
        for (var i=0; i<data.objects.length; i++) {
            switch (data.objects[i].kind) {
                case 'Police Beat':
                    $('#address-results #policebeat').text(data.objects[i].name);
                    break;
                case 'Community Area':
                    $('#address-results #communityarea').text(data.objects[i].name);
                    break;
                case 'Neighborhood':
                    $('#address-results #neighborhood').text(data.objects[i].name);
                    break;
            }
        }
    } else {
        $('#address-results #policebeat').empty();
        $('#address-results #communityarea').empty();
        $('#address-results #neighborhood').empty();
    }
}

var radioIds = null;

function initRadioIds() {
    var url = "https://script.google.com/macros/s/AKfycbwdMu3lgUaMPqA-ESlmhD12Yo6Jz78LlCM8cMQXW7Cm4O94sAA/exec?id=1kiv-ELXw9Z-LcfZ87dFlBDN4GMdjZv_Iz5DSxTH_Cd4&sheet=Radio%20IDs&callback=parseSheet";
    $.ajax({
        url: url,
        jsonp: "parseSheet",
        dataType: "jsonp",
        crossDomain: true
    });
}

function parseSheet(data) {
    radioIds = data["Radio IDs"];
}

function showMatches(query) {
    $('#radioid-results td').text('Loading...');
    var matches = [];
    radioIds.forEach(function (row, index) {
        if (query.match('^' + row.ID_Number + '[A-Za-z]?$')) {
            matches.push(row);
        }
    });
    $('#radioid-results td').empty();
    if (matches.length > 0) {
        matches.forEach(function (match, index) {
            if (match.Agency.length) $('#radioid-results #agency').text(match.Agency);
            if (match.Level_1.length) $('#radioid-results #level1').text(match.Level_1);
            if (match.Level_2.length) $('#radioid-results #level2').text(match.Level_2);
            if (match.Level_3.length) $('#radioid-results #level3').text(match.Level_3);
            if (match.Level_4.length) {
                if (match.Level_4 == 'Beat Car') {
                    $('#radioid-results #level4').text('Beat #' + query.match(/\d+/)[0]);
                } else {
                    $('#radioid-results #level4').text(match.Level_4);
                }
            }
            // match.ID_Number
        });
    }
}
