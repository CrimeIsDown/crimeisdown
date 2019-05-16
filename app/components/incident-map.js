/*eslint-disable no-unused-vars*/
/*global GeoSearch*/
/*global mejs*/
/*global MediaElementPlayer*/

import Component from '@ember/component';
import { get } from '@ember/object';
import { schedule } from '@ember/runloop';
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
    let isMobileSafari = navigator.userAgent.match(/(iPod|iPhone|iPad)/) && navigator.userAgent.match(/AppleWebKit/);
    this.set('mediaSourceSupported', (('MediaSource' in window) || ('WebKitMediaSource' in window)) && !isMobileSafari);
  },

  didInsertElement() {
    L.Icon.Default.imagePath = '/assets/images/';
    this.initMap();
    if (this.mediaSourceSupported) {
      this.set('audioPlayer', new MediaElementPlayer('streamplayer', {
        pluginPath: "https://cdn.jsdelivr.net/npm/mediaelement@4.2.9/build/",
        shimScriptAccess: 'always',
        renderers: ['native_dash', 'flash_dash'],
        isVideo: false,
        features: ['playpause', 'current', 'volume']
      }));
    } else {
      this.set('audioPlayer', new MediaElementPlayer('streamplayer', {
        pluginPath: "https://cdn.jsdelivr.net/npm/mediaelement@4.2.9/build/",
        shimScriptAccess: 'always',
        renderers: ['html5', 'native_hls', 'flash_hls'],
        isVideo: false,
        features: ['playpause', 'current', 'volume']
      }));
    }
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
      center: [41.85, -87.63],
      zoom: 11
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

    L.streetView({
      position: 'topleft',
      google: true,
      bing: false,
      yandex: false,
      mapillary: false,
      openstreetcam: false,
      mosatlas: false
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
        let wazeIframeUrl = 'https://embed.waze.com/iframe?zoom=14&lat=' + this.location.meta.latitude + '&lon=' + this.location.meta.longitude;
        $('#waze-map').attr('src', wazeIframeUrl);
        if (this.location.meta.inChicago) {
          let randomInt = Math.round(Math.random() * 1000);
          let crimereportsIframeUrl = 'https://www.crimereports.com/city/Chicago%2C%20IL?is_widget=true&_=' + randomInt + '#!/dashboard?lat=' + this.location.meta.latitude + '&lng=' + this.location.meta.longitude + '&zoom=17&start_date=2018-11-24&end_date=2018-12-24&date_type=relative&current_tab=list&shapeIds=&shape_id=false&incident_types=Alarm%252CArson%252CAssault%252CAssault%2520with%2520Deadly%2520Weapon%252CBreaking%2520%2526%2520Entering%252CCommunity%2520Policing%252CDeath%252CDisorder%252CDrugs%252CEmergency%252CFamily%2520Offense%252CFire%252CHomicide%252CKidnapping%252CLiquor%252CMissing%2520Person%252COther%252COther%2520Sexual%2520Offense%252CPedestrian%2520Stop%252CProactive%2520Policing%252CProperty%2520Crime%252CProperty%2520Crime%2520Commercial%252CProperty%2520Crime%2520Residential%252CQuality%2520of%2520Life%252CRobbery%252CSexual%2520Assault%252CSexual%2520Offense%252CTheft%252CTheft%2520from%2520Vehicle%252CTheft%2520of%2520Vehicle%252CTraffic%252CVehicle%2520Recovery%252CVehicle%2520Stop%252CWeapons%2520Offense';
          $('#crimereports-map').attr('src', crimereportsIframeUrl);

          schedule('afterRender', () => {
            $('[data-toggle="tooltip"]').removeAttr('data-original-title').tooltip();
          });

          if (!this.audioPlayer.duration || this.audioPlayer.paused) {
            if (this.mediaSourceSupported) {
              this.audioPlayer.setSrc({
                src: 'https://audio.crimeisdown.com/streaming/dash/zone' + this.location.police.zone.num + '/',
                type: 'application/dash+xml'
              });
            } else {
              this.audioPlayer.setSrc({
                src: 'https://audio.crimeisdown.com/streaming/hls/zone' + this.location.police.zone.num + '/index.m3u8',
                type: 'application/x-mpegURL'
              });
            }
            this.audioPlayer.load();
            this.set('currentZoneStream', null);
            this.audioPlayer.media.addEventListener('playing', () => {
              this.set('currentZoneStream', this.location.police.zone.num);
            });
          }
        }
      });

      resolve();
    });
  },

  initLayers() {
    this.set('layers', {
      fireStations: {
        label: "Fire Stations",
        layer: null,
        url: '/data/city_data/fire_stations.json',
        showByDefault: true
      },
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

          if (layerName != 'fireStations') {
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
          } else {
            let layerGroup = L.markerClusterGroup();
            if (layerObj.showByDefault) {
              layerGroup.addTo(map);
            }
            layerObj.layer = layerGroup;
            this.overlay[layerObj.label] = layerObj.layer;
            fetch(layerObj.url).then((response) => {
              response.json().then((data) => {
                data.forEach((location) => {
                  let markerTitle = location.name ? location.name : [location.engine, location.truck, location.ambo, location.squad].filter(Boolean).join('-');

                  let stationMarker = L.marker([location.latitude, location.longitude], {
                    title: markerTitle,
                    icon: L.AwesomeMarkers.icon({
                      icon: 'fire-extinguisher',
                      prefix: 'fa',
                      markerColor: 'red'
                    })
                  });

                  // Convert address to title case
                  location.addr = location.addr.toLowerCase().replace(/(?:^|\s|-|\/)\S/g, function(m) {
                    return m.toUpperCase();
                  });

                  // this is a really hacky way to make a popup, we should stop doing it
                  // @TODO: Use Handlebars template to make Leaflet popup
                  let popupContents = '<h6>' + markerTitle + '</h6>' +
                    '<strong>' + location.addr + '</strong>' +
                    (location.engine ? '<br><strong>Engine:</strong> ' + location.engine : '') +
                    (location.truck ? '<br><strong>Truck/Tower:</strong> ' + location.truck : '') +
                    (location.ambo ? '<br><strong>Ambulance:</strong> ' + location.ambo : '') +
                    (location.squad ? '<br><strong>Squad:</strong> ' + location.squad : '') +
                    (location.special ? '<br><strong>Special (search radio IDs):</strong> ' + location.special : '') +
                    (location.batt ? '<br><strong>Battalion:</strong> ' + location.batt + ' / <strong>District:</strong> ' + location.fireDist : '') +
                    (location.emsDist ? '<br><strong>EMS District:</strong> ' + location.emsDist : '') +
                    (location.radio ? '<br><strong>Radio Channel:</strong> ' + location.radio : '');
                  stationMarker.bindPopup(popupContents).openPopup();

                  layerGroup.addLayer(stationMarker);
                });
                resolve();
              }).catch((err) => {
                reject(err);
              })
            }).catch((err) => {
              reject(err);
            });
          }
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
        polyline: {
          shapeOptions: {
            color: '#00ff00',
            weight: 10
          }
        },
        polygon: {
          showArea: true,
          allowIntersection: false,
          drawError: {
            color: '#da2600', // Color the shape will turn when intersects
            message: '<strong>Error:<strong> Polygon cannot intersect with itself' // Message that will show when intersect
          },
          shapeOptions: {
            color: '#00ff00'
          }
        }
      }
    }));

    let drawEventCreated = (event) => {
      let layer = event.layer;
      // layer.bindPopup('<button type="button" class="btn btn-primary" data-toggle="modal" data-target="#add-incident-modal">Add Incident</button>').openPopup();

      this.overlay['User Features'].addLayer(layer);
    };

    this.map.on(L.Draw.Event.CREATED, drawEventCreated.bind(this));
  }
});
