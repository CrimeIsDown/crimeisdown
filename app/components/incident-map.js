/*eslint-disable no-unused-vars*/

import Ember from 'ember';
import fetch from 'npm:whatwg-fetch'; // polyfill for fetch() used by leaflet-geosearch
import L from 'npm:leaflet';
import GoogleMutant from 'npm:leaflet.gridlayer.googlemutant';
import GeoSearch from 'npm:leaflet-geosearch';

export default Ember.Component.extend({
  map: null,
  geocoder: null,
  addressLookup: Ember.inject.service(),
  baseLayers: {},
  layers: {},
  overlay: {},
  location: {},

  didInsertElement() {
    L.Icon.Default.imagePath = '/assets/images/';
    this.initMap();

    let searchControl = this.get('searchControl');
    Ember.$('#address-search > form').submit(function (event) {
      event.preventDefault();
      Ember.$('.leaflet-control-geosearch.bar form input').val(Ember.$('#address-search > form input[name="address"]').val());
      searchControl.searchElement.handleSubmit({ query: Ember.$('.leaflet-control-geosearch.bar form input').val() });
    });

    setTimeout(() => {
      if (window.location.hash) {
        let hash = window.location.hash.substr(1),
          query = hash.substr(hash.indexOf('location_query='))
            .split('&')[0]
            .split('=')[1];
        query = decodeURIComponent(query.replace(/\+/g, " "));
        Ember.$('.leaflet-control-geosearch.bar form input').val(query);
        searchControl.searchElement.handleSubmit({ query: Ember.$('.leaflet-control-geosearch.bar form input').val() });
      }
    }, 500); // wait until we have everything loaded
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

    this.get('baseLayers')["Google Hybrid"] = new L.gridLayer.googleMutant({
      type: 'hybrid',
      minZoom: 0,
      maxZoom: 20
    });
  },

  initGeocoder() {
    const provider = new GeoSearch.GoogleProvider({
      params: {
        key: 'REDACTED_PUBLIC_CREDENTIAL',
        bounds: '41.60218817897012,-87.9728821400663|42.05134582102988,-87.37011785993366'
      },
    });

    const searchControl = new GeoSearch.GeoSearchControl({
      provider: provider,
      style: 'bar',
      autoComplete: false,
      showPopup: true,
      maxMarkers: 3
    });
    this.set('searchControl', searchControl);

    this.get('map').addControl(searchControl);
    Ember.$('.leaflet-control-geosearch.bar form input').attr('autofocus', true);

    this.get('map').on('geosearch/showlocation', (event) => {
      if (window.ga && typeof window.ga === "function") {
        ga('send', 'event', 'Looks up address', 'Tools', Ember.$('.leaflet-control-geosearch.bar form input').val());
      }
      window.location.hash = '#location_query=' + encodeURIComponent(Ember.$('.leaflet-control-geosearch.bar form input').val());
      let location = event.location.raw;
      this.set('location', this.get('addressLookup').generateLocationDataForAddress(this.get('layers'), location));
    });
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
