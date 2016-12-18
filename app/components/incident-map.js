import Ember from 'ember';

export default Ember.Component.extend({
  map: null,
  geocoder: null,
  addressLookup: Ember.inject.service(),
  baseLayers: {},
  layers: {},
  overlay: {},
  location: {},

  didInsertElement() {
    L.Icon.Default.imagePath = '/assets/images';
    this.initMap();
  },

  initMap() {
    this.set('map', L.map('leaflet-map', {
      center: [41.8781, -87.6298],
      zoom: 10
    }));

    this.initBaseLayers();
    this.initGeocoder();
    this.initInfoBox();
    this.initLayers();
    this.get('addressLookup').loadData();

    L.control.layers(this.get('baseLayers'), this.get('overlay'), {
      collapse: false
    }).addTo(this.get('map'));
  },

  initBaseLayers() {
    this.get('baseLayers')["OpenStreetMap"] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
      maxNativeZoom: 19,
      minZoom: 0,
      maxZoom: 20
    }).addTo(this.get('map'));

    this.get('baseLayers')["MapBox Streets"] = L.tileLayer('https://api.mapbox.com/styles/v1/erictendian/ciqn6pmjh0005bini99og1s6q/tiles/256/{z}/{x}/{y}?access_token=REDACTED_PUBLIC_CREDENTIAL', {
      attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      minZoom: 0,
      maxZoom: 20
    });

    this.get('baseLayers')["Google Hybrid"] = new L.Google('HYBRID', {
      minZoom: 0,
      maxZoom: 20
    });
  },

  initGeocoder() {
    let handleGeocodeResult = (place) => {
      console.log(place);
      if (!place.geometry) {
        alert("Location not found");
        return;
      }
      if (place.geometry.viewport) {
        let southWest = L.latLng(place.geometry.viewport.getNorthEast().lat(), place.geometry.viewport.getNorthEast().lng()),
            northEast = L.latLng(place.geometry.viewport.getSouthWest().lat(), place.geometry.viewport.getSouthWest().lng()),
            viewport = L.latLngBounds(southWest, northEast);
        this.get('map').fitBounds(viewport, {
          maxZoom: 18
        });
      }
      if (this.get('locationMarker')) {
        this.get('map').removeLayer(this.get('locationMarker'));
      }
      this.set('locationMarker', L.marker(L.latLng(place.geometry.location.lat(), place.geometry.location.lng())).addTo(this.get('map')));
      this.set('location', this.get('addressLookup').generateLocationDataForAddress(this.get('layers'), place));
    };

    handleGeocodeResult = handleGeocodeResult.bind(this);

    this.set('geocoder', new L.Control.GPlaceAutocomplete({
        callback: handleGeocodeResult,
        autocomplete_options: {
          bounds: {
            east: '-87.37011785993366',
            north: '42.05134582102988',
            south: '41.60218817897012',
            west: '-87.9728821400663'
          }
        }
      })
      .addTo(this.get('map'))
    );
  },

  initLayers() {
    this.set('layers', {
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
    });

    this.loadLayerData(this.get('layers'));
  },

  loadLayerData(layers) {
    let map = this.get('map');
    let info = this.get('infobox');

    for (let layerName in layers) {
      if (layers.hasOwnProperty(layerName)) {
        let layerObj = layers[layerName];

        let layerMouseover = (e) => {
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
        };

        let geoJsonLayer = L.geoJson(null, {
          onEachFeature: (feature, layer) => {
            layer.on({
              mouseover: layerMouseover,
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
        this.get('overlay')[layerObj.label] = layerObj.layer;
        Ember.$.getJSON(layerObj.url).done((data) => {
          layerObj.layer.addData(data).setStyle(layerObj.style);
        });
      }
    }
  },

  initInfoBox() {
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

    info.addTo(this.get('map'));

    this.set('infobox', info);
  }
});
