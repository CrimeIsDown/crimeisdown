import Ember from 'ember';

export default Ember.Component.extend({
  lat: 41.8781,
  lng: -87.6298,
  zoom: 10,
  didInsertElement() {
    L.Icon.Default.imagePath = '/assets/images';
    let map = L.map('leaflet-map', {
      center: [this.lat, this.lng],
      zoom: this.zoom
    });

    let osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>'
    }).addTo(map);

    let mapboxStreets = L.tileLayer('https://api.mapbox.com/styles/v1/erictendian/ciqn6pmjh0005bini99og1s6q/tiles/256/{z}/{x}/{y}?access_token=REDACTED_PUBLIC_CREDENTIAL', {
      attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    let googleHybrid = new L.Google('HYBRID');

    let handleGeocodeResult = function (e) {
      console.log(e.geocode);
      map.fitBounds(e.geocode.bbox);
      let properties = {};
      if (e.geocode.properties[3].long_name == 'Chicago') {
        for (let layerName in layers) {
          if (layers.hasOwnProperty(layerName)) {
            let result = leafletPip.pointInLayer(e.geocode.center, layers[layerName].layer, true)[0];
            if (result) {
              properties[layerName] = JSON.stringify(result.feature.properties)
            }
          }
        }
        info.update(properties);
      }
    };

    let geocoder = L.Control.geocoder({
        geocoder: L.Control.Geocoder.google('REDACTED_PUBLIC_CREDENTIAL', {
          geocodingQueryParams: {
            bounds: '41.60218817897012,-87.37011785993366|42.05134582102988,-87.9728821400663'
          }
        }),
        collapsed: false
      })
      .on('markgeocode', handleGeocodeResult)
      .addTo(map);

    let layers = {
      policeDistricts: {
        label: "Police Districts",
        layer: null,
        url: '/data/map_data/police_districts.geojson',
        showByDefault: true,
        style: {
          fill: true,
          fillOpacity: 0.05,
          color: '#00f',
          weight: 3
        }
      },
      policeBeats: {
        label: "Police Beats",
        layer: null,
        url: '/data/map_data/police_beats.geojson',
        showByDefault: false,
        style: {
          fill: true,
          fillOpacity: 0.05,
          color: '#00f',
          weight: 2
        }
      },
      neighborhoods: {
        label: "Neighborhoods",
        layer: null,
        url: '/data/map_data/neighborhoods.geojson',
        showByDefault: false,
        style: {
          fill: true,
          fillOpacity: 0.05,
          color: '#a00',
          weight: 2
        }
      },
      communityAreas: {
        label: "Community Areas",
        layer: null,
        url: '/data/map_data/community_areas.geojson',
        showByDefault: false,
        style: {
          fill: true,
          fillOpacity: 0.05,
          color: '#333',
          weight: 3
        }
      },
      wards: {
        label: "Wards",
        layer: null,
        url: '/data/map_data/wards.geojson',
        showByDefault: false,
        style: {
          fill: true,
          fillOpacity: 0.05,
          color: '#030',
          weight: 2
        }
      }
    };

    let overlay = {};

    for (let layerName in layers) {
      if (layers.hasOwnProperty(layerName)) {
        let layerObj = layers[layerName];
        let geoJsonLayer = L.geoJson(null, {
          onEachFeature: (feature, layer) => {
            layer.on({
              mouseover: (e) => {
                let layer = e.target;

                info.update(layer.feature.properties);
                if (map.getZoom() < 14) {
                  layer.setStyle({
                    color: '#ff0',
                    fillOpacity: 0.15
                  });
                } else {
                  e.target.setStyle(layerObj.style);
                }

                if (!L.Browser.ie && !L.Browser.opera) {
                  layer.bringToFront();
                }
              },
              mouseout: (e) => {
                e.target.setStyle(layerObj.style);
                info.update();
              },
              click: (e) => {
                map.fitBounds(e.target.getBounds());
              }
            });
          }
        });
        if (layerObj.showByDefault) {
          geoJsonLayer.addTo(map);
        }
        layerObj.layer = geoJsonLayer;
        overlay[layerObj.label] = layerObj.layer;
        Ember.$.getJSON(layerObj.url).done((data) => {
          layerObj.layer.addData(data).setStyle(layerObj.style);
        });
      }
    }

    L.control.layers({
      "OpenStreetMap": osm,
      "MapBox Streets": mapboxStreets,
      "Google Hybrid": googleHybrid
    }, overlay, {
      collapse: false
    }).addTo(map);

    let info = L.control();

    info.onAdd = function (map) {
      this._div = L.DomUtil.create('div', 'info');
      this.update();
      return this._div;
    };

    info.update = function (props) {
      let html = '<h4>Layer Info</h4>';
      for (let key in props) {
        if (props.hasOwnProperty(key)) {
          html += '<p>' + key + ': ' + props[key] + '</p>';
        }
      }
      this._div.innerHTML = html;
    };

    info.addTo(map);
  }
});
