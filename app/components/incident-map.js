/*eslint-disable no-unused-vars*/
/*global GeoSearch*/

import Component from '@ember/component';
import { inject as service } from '@ember/service';
import $ from 'jquery';

export default Component.extend({
  addressLookup: service(),
  init() {
    this._super(...arguments);
    this.map = null;
    this.geocoder = null;
    this.baseLayers = {};
    this.layers = {};
    this.overlay = {};
    this.location = {};
  },

  didInsertElement() {
    L.Icon.Default.imagePath = '/assets/images/';
    this.initMap();
  },

  actions: {
    searchAddress(address) {
      $('.leaflet-control-geosearch.bar form input').val(address);
      $('#address-search').find('input[name="address"]').val(address);
      this.get('searchControl').searchElement.handleSubmit({ query: address });
    }
  },

  initMap() {
    this.set('map', L.map('leaflet-map', {
      center: [41.8781, -87.6298],
      zoom: 10
    }));

    Promise.all([
      this.initBaseLayers(),
      this.initGeocoder(),
      this.initInfoBox(),
      this.initLayers(),
      this.get('addressLookup').loadData()
    ]).then(() => {
      // wait for everything to load before trying to geocode an address
      if (window.location.hash) {
        let hash = window.location.hash.substr(1),
          query = hash.substr(hash.indexOf('location_query='))
            .split('&')[0]
            .split('=')[1];
        query = decodeURIComponent(query.replace(/\+/g, " "));
        this.actions.searchAddress.bind(this)(query);
      }
    });

    this.initEditableMap();

    L.control.layers(this.get('baseLayers'), this.get('overlay'), {
      collapse: false
    }).addTo(this.get('map'));
  },

  initBaseLayers() {
    return new Promise((resolve, reject) => {
      this.get('baseLayers')["OpenStreetMap"] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
        maxNativeZoom: 19,
        minZoom: 0,
        maxZoom: 20
      });

      this.get('baseLayers')["MapBox Streets"] = L.tileLayer('https://api.mapbox.com/styles/v1/erictendian/ciqn6pmjh0005bini99og1s6q/tiles/256/{z}/{x}/{y}?access_token=REDACTED_PUBLIC_CREDENTIAL', {
        attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        minZoom: 0,
        maxZoom: 20
      });

      this.get('baseLayers')["MapBox Streets Dark"] = L.tileLayer('https://api.mapbox.com/styles/v1/erictendian/cj9ne99zz3e112rp4pxcpua1z/tiles/256/{z}/{x}/{y}?access_token=REDACTED_PUBLIC_CREDENTIAL', {
        attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        minZoom: 0,
        maxZoom: 20
      });

      this.get('baseLayers')["Google Hybrid"] = new L.gridLayer.googleMutant({
        type: 'hybrid',
        minZoom: 0,
        maxZoom: 20
      });

      if (localStorage.getItem('dark')) {
        this.get('baseLayers')["MapBox Streets Dark"].addTo(this.get('map'));
      } else {
        this.get('baseLayers')["OpenStreetMap"].addTo(this.get('map'));
      }

      resolve();
    });
  },

  initGeocoder() {
    return new Promise((resolve, reject) => {
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

      this.get('map').on('geosearch/showlocation', (event) => {
        let query = $('.leaflet-control-geosearch.bar form input').val();
        $('#address-search').find('input[name="address"]').val(query);
        if (window.ga && typeof window.ga === "function") {
          ga('send', 'event', 'Looks up address', 'Tools', query);
        }
        window.location.hash = '#location_query=' + encodeURIComponent(query);
        this.set('location', this.get('addressLookup').generateLocationDataForAddress(this.get('layers'), event.location.raw));
      });

      resolve();
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

    return this.loadLayerData(this.get('layers'));
  },

  loadLayerData(layers) {
    let map = this.get('map');
    let info = this.get('infobox');

    let promises = [];

    for (let layerName in layers) {
      promises.push(new Promise((resolve, reject) => {
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
          fetch(layerObj.url).then((response) => {
            response.json().then((data) => {
              layerObj.layer.addData(data).setStyle(layerObj.style);
              resolve();
            }).catch((err) => {
              reject(err);
            })
          }).catch((err) => {
            reject(err);
          });
        }
      }));
    }

    return Promise.all(promises);
  },

  initInfoBox() {
    return new Promise((resolve, reject) => {
      let info = L.control();

      info.onAdd = function () {
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
      resolve();
    });
  },

  initEditableMap() {
    this.get('overlay')['User Features'] = L.markerClusterGroup()
      .addTo(this.get('map'));

    this.get('map').addControl(new L.Control.Draw({
      edit: {
        featureGroup: this.get('overlay')['User Features'],
        poly: {
          allowIntersection: false
        }
      },
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true
        }
      }
    }));

    let drawEventCreated = (event) => {
      let layer = event.layer;
      layer.bindPopup('<button type="button" class="btn btn-primary" data-toggle="modal" data-target="#add-incident-modal"> Launch demo modal </button>').openPopup();

      this.get('overlay')['User Features'].addLayer(layer);
    };

    this.get('map').on(L.Draw.Event.CREATED, drawEventCreated.bind(this));
  }
});
