/*eslint-disable no-unused-vars*/
/*global GeoSearch*/
/*global mejs*/
/*global MediaElementPlayer*/

import Component from '@ember/component';
import { get } from '@ember/object';
import { inject as service } from '@ember/service';
import $ from 'jquery';
import ENV from '../config/environment';

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
    let isSafari = navigator.userAgent.search("Safari") > 0 && navigator.userAgent.search("Chrome") < 0;
    this.set('mediaSourceSupported', (('MediaSource' in window) || ('WebKitMediaSource' in window)) && !isSafari);
  },

  didInsertElement() {
    L.Icon.Default.imagePath = '/assets/images/';
    this.initMap();
    mejs.Renderers.order = ['native_dash', 'flash_dash'];
    this.set('audioPlayer', new MediaElementPlayer('streamplayer', {
      pluginPath: "https://cdn.jsdelivr.net/npm/mediaelement@4.2.9/build/",
      shimScriptAccess: 'always',
      renderers: ['native_dash', 'flash_dash'],
      isVideo: false,
      features: ['playpause', 'current', 'volume']
    }));
  },

  actions: {
    searchAddress(address) {
      $('.leaflet-control-geosearch.bar form input').val(address);
      $('#address-search').find('input[name="address"]').val(address);
      this.searchControl.searchElement.handleSubmit({ query: address });
    },
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
      this.addressLookup.loadData()
    ]).then(() => {
      let incidents = this.get('model.incidents');
      if (incidents) {
        incidents.forEach((incident) => {
          get(incident, 'location.layer').addTo(this.overlay['User Features']);
        });
      }

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

    L.control.layers(this.baseLayers, this.overlay, {
      collapse: false
    }).addTo(this.map);
  },

  initBaseLayers() {
    return new Promise((resolve, reject) => {
      this.baseLayers["OpenStreetMap"] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
        maxNativeZoom: 19,
        minZoom: 0,
        maxZoom: 20
      });

      this.baseLayers["MapBox Streets"] = L.tileLayer('https://api.mapbox.com/styles/v1/erictendian/ciqn6pmjh0005bini99og1s6q/tiles/256/{z}/{x}/{y}?access_token=REDACTED_PUBLIC_CREDENTIAL', {
        attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        minZoom: 0,
        maxZoom: 20
      });

      this.baseLayers["MapBox Streets Dark"] = L.tileLayer('https://api.mapbox.com/styles/v1/erictendian/cj9ne99zz3e112rp4pxcpua1z/tiles/256/{z}/{x}/{y}?access_token=REDACTED_PUBLIC_CREDENTIAL', {
        attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        minZoom: 0,
        maxZoom: 20
      });

      this.baseLayers["Google Hybrid"] = new L.gridLayer.googleMutant({
        type: 'hybrid',
        minZoom: 0,
        maxZoom: 20
      });

      if (localStorage.getItem('dark')) {
        this.baseLayers["MapBox Streets Dark"].addTo(this.map);
      } else {
        this.baseLayers["OpenStreetMap"].addTo(this.map);
      }

      resolve();
    });
  },

  initGeocoder() {
    return new Promise((resolve, reject) => {
      this.set('geosearchProvider', new GeoSearch.GoogleProvider({
        params: {
          key: 'REDACTED_PUBLIC_CREDENTIAL',
          bounds: '41.60218817897012,-87.9728821400663|42.05134582102988,-87.37011785993366'
        },
      }));

      const searchControl = new GeoSearch.GeoSearchControl({
        provider: this.geosearchProvider,
        style: 'bar',
        autoComplete: false,
        showPopup: true,
        maxMarkers: 3
      });
      this.set('searchControl', searchControl);

      this.map.addControl(searchControl);

      this.map.on('geosearch/showlocation', (event) => {
        let query = $('.leaflet-control-geosearch.bar form input').val();
        $('#address-search').find('input[name="address"]').val(query);
        if (window.ga && typeof window.ga === "function") {
          ga('send', 'event', 'Looks up address', 'Tools', query);
        }
        window.location.hash = '#location_query=' + encodeURIComponent(query);
        this.set('location', this.addressLookup.generateLocationDataForAddress(this.layers, event.location.raw));
        if (!this.audioPlayer.duration || this.audioPlayer.paused) {
          this.audioPlayer.setSrc({
            src: 'https://audio.crimeisdown.com/streaming/dash/zone' + this.location.police.zone.num + '/',
            type: 'application/dash+xml'
          });
          this.audioPlayer.load();
          this.set('currentZoneStream', null);
          this.audioPlayer.media.addEventListener('playing', () => {
            this.set('currentZoneStream', this.location.police.zone.num);
          });
        }
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

    return this.loadLayerData(this.layers);
  },

  loadLayerData(layers) {
    let map = this.map;
    let info = this.infobox;

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
          this.overlay[layerObj.label] = layerObj.layer;
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

      info.addTo(this.map);

      this.set('infobox', info);
      resolve();
    });
  },

  initEditableMap() {
    this.overlay['User Features'] = L.markerClusterGroup()
      .addTo(this.map);

    this.map.addControl(new L.Control.Draw({
      edit: {
        featureGroup: this.overlay['User Features'],
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
      // layer.bindPopup('<button type="button" class="btn btn-primary" data-toggle="modal" data-target="#add-incident-modal"> Launch demo modal </button>').openPopup();

      this.overlay['User Features'].addLayer(layer);
    };

    this.map.on(L.Draw.Event.CREATED, drawEventCreated.bind(this));
  }
});
