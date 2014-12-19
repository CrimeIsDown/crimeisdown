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

function initialize() {
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
    map = new google.maps.Map(document.getElementById("map_canvas"),
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
                    i = 999; // Jump out of loop
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
    $('p#addressinfo').remove();
    if (data.objects.length) {
        var zone = 'N/A';
        var info = '';
        for (var i=0; i<data.objects.length; i++) {
            info += '<strong>'+data.objects[i].kind + ':</strong> ' + data.objects[i].name + '<br>';
            if (data.objects[i].kind=="Police District") {
                switch (data.objects[i].name) {
                    case '16th':
                    case '17th':
                        zone = '1';
                        break;
                    case '19th':
                        zone = '2';
                        break;
                    case '12th':
                    case '14th':
                        zone = '3';
                        break;
                    case '1st':
                    case '18th':
                        zone = '4';
                        break;
                    case '2nd':
                        zone = '5';
                        break;
                    case '7th':
                    case '8th':
                        zone = '6';
                        break;
                    case '3rd':
                        zone = '7';
                        break;
                    case '4th':
                    case '6th':
                        zone = '8';
                        break;
                    case '5th':
                    case '22nd':
                        zone = '9';
                        break;
                    case '10th':
                    case '11th':
                        zone = '10';
                        break;
                    case '20th':
                    case '24th':
                        zone = '11';
                        break;
                    case '15th':
                    case '25th':
                        zone = '12';
                        break;
                    case '9th':
                        zone = '13';
                        break;
                }
            }
        }
        $('#infobox').append('<p id="addressinfo"><strong>Zone:</strong> ' + zone + '<br>' + info + '</p>');
    }
}
