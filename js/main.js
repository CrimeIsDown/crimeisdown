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
