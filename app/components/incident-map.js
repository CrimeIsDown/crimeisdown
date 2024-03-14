/*eslint-disable no-unused-vars*/
/*global GeoSearch*/
/*global leafletPip*/

import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action, set } from '@ember/object';
import { debounce, schedule } from '@ember/runloop';
import { inject as service } from '@ember/service';
import $ from 'jquery';

export default class IncidentMap extends Component {
  @service metrics;
  @service addressLookup;
  map = null;
  geocoder = null;
  previousGeolocationMarker = null;
  previousGeolocationCircle = null;

  @tracked
  geolocationPending = false;

  @tracked
  baseLayers = {};

  @tracked
  layers = {};

  @tracked
  overlay = {};

  @tracked
  location = {};

  @tracked
  location_approximate = false;

  @tracked
  wazeIframeUrl =
    'https://embed.waze.com/iframe?zoom=11&lat=41.85&lon=-87.63&ct=livemap';

  @tracked
  crimereportsIframeUrl =
    'https://chicagopd.maps.arcgis.com/apps/webappviewer/index.html?id=96ca65e89cd54b8c808b136a66778369';

  constructor() {
    super(...arguments);

    L.Icon.Default.imagePath = '/assets/images/';
  }

  removePreviousGeoLocationMarkers() {
    if (this.previousGeolocationMarker) {
      this.previousGeolocationMarker.remove();
    }
    if (this.previousGeolocationCircle) {
      this.previousGeolocationCircle.remove();
    }
  }

  setGeoLocationMarkers(marker, circle) {
    this.previousGeolocationMarker = marker;
    this.previousGeolocationCircle = circle;
  }

  @action
  searchAddress(event = null) {
    if (event) {
      event.preventDefault();
    }
    const fireStationResults = this.addressLookup.findStation(this.address);
    if (fireStationResults.length) {
      this.address =
        fireStationResults[0].addr + ' ' + fireStationResults[0].zip;
    }
    $('.leaflet-control-geosearch form input').val(this.address);
    $('#address-search').find('input[name="address"]').val(this.address);
    this.searchControl.searchElement.handleSubmit({ query: this.address });
  }

  @action
  locateMe() {
    this.geolocationPending = true;

    // Clear any form fields so it doesn't appear we are still using that address
    $('.leaflet-control-geosearch.bar form input').val('');
    $('#address-search').find('input[name="address"]').val('');

    this.map.locate({ setView: true, maxZoom: 16 });

    this.map.on('locationfound', (e) => {
      this.removePreviousGeoLocationMarkers();

      if (e.accuracy > 1000) {
        alert(
          'Warning: We were not able to determine a precise location, so your location results may be incorrect. Try a different device for better results.'
        );
      }

      const radius = e.accuracy * 3.28084; // convert radius to feet

      const marker = L.marker(e.latlng)
        .addTo(this.map)
        .bindPopup(
          'You are within ' + radius.toPrecision(5) + ' feet of this point'
        )
        .openPopup();
      const circle = L.circle(e.latlng, radius, { fill: radius < 1000 }).addTo(
        this.map
      );

      this.setGeoLocationMarkers(marker, circle);

      this.showLocation({
        location: {
          raw: {
            formatted_address: 'N/A - From device location',
            geometry: {
              location: {
                lat: () => e.latlng.lat,
                lng: () => e.latlng.lng,
              },
            },
          },
        },
      });

      this.geolocationPending = false;
    });

    this.map.on('locationerror', (e) => {
      alert(
        e.message +
          ' If you are on iOS, make sure to enable Location Services first.'
      );

      this.geolocationPending = false;
    });
  }

  @action
  async initMap() {
    const defaultCenterLat = 41.85;
    const defaultCenterLong = -87.63;
    const defaultZoom = 11;
    this.map = L.map('leaflet-map', {
      center: [defaultCenterLat, defaultCenterLong],
      zoom: defaultZoom,
    });

    // Initilize this first to put it above the layers control
    this.initInfoBox();

    L.Control.Layers.include({
      getActiveOverlays: () => {
        const active = [];
        if (this.layersControl._layers) {
          this.layersControl._layers.forEach((obj) => {
            if (obj.overlay && this.layersControl._map.hasLayer(obj.layer)) {
              active.push(obj);
            }
          });
        }
        return active;
      },
    });

    this.layersControl = new L.Control.Layers(undefined, undefined, {
      collapsed: !window.matchMedia('(min-width: 768px)').matches,
    }).addTo(this.map);

    L.streetView({
      position: 'topleft',
      google: true,
      bing: false,
      yandex: false,
      mapillary: false,
      openstreetcam: false,
      mosatlas: false,
    }).addTo(this.map);

    this.initBaseLayers();

    this.initGeocoder();

    this.initEditableMap();

    await this.initLayers();
    await this.addressLookup.loadData();

    if (window.location.hash) {
      const hash = window.location.hash.substring(1);
      this.address = decodeURIComponent(
        hash
          .substring(hash.indexOf('location_query='))
          .split('&')[0]
          .split('=')[1]
          .replace(/\+/g, ' ')
      );
      this.searchAddress();
    }

    const tabs = [
      document.getElementById('traffic-tab'),
      document.getElementById('crime-tab'),
    ];
    for (const tabEl of tabs) {
      tabEl.addEventListener('show.bs.tab', function (event) {
        const iframe = document
          .getElementById(event.target.getAttribute('aria-controls'))
          .getElementsByTagName('iframe')[0];
        if (iframe.src != iframe.parentElement.getAttribute('data-src')) {
          iframe.src = iframe.parentElement.getAttribute('data-src');
        }
      });
    }
  }

  initBaseLayers() {
    const mapbox = L.tileLayer(
      'https://api.mapbox.com/styles/v1/erictendian/ciqn6pmjh0005bini99og1s6q/tiles/256/{z}/{x}/{y}?access_token=REDACTED_PUBLIC_CREDENTIAL',
      {
        attribution:
          '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        minZoom: 0,
        maxZoom: 20,
      }
    );

    this.layersControl.addBaseLayer(mapbox, 'MapBox Streets');

    const mapboxDark = L.tileLayer(
      'https://api.mapbox.com/styles/v1/erictendian/cj9ne99zz3e112rp4pxcpua1z/tiles/256/{z}/{x}/{y}?access_token=REDACTED_PUBLIC_CREDENTIAL',
      {
        attribution:
          '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        minZoom: 0,
        maxZoom: 20,
      }
    );
    this.layersControl.addBaseLayer(mapboxDark, 'MapBox Streets Dark');

    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      mapboxDark.addTo(this.map);
    } else {
      mapbox.addTo(this.map);
    }

    this.layersControl.addBaseLayer(
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
        maxNativeZoom: 19,
        minZoom: 0,
        maxZoom: 20,
      }),
      'OpenStreetMap'
    );

    this.layersControl.addBaseLayer(
      new L.gridLayer.googleMutant({
        type: 'hybrid',
        minZoom: 0,
        maxZoom: 20,
      }),
      'Google Hybrid'
    );
  }

  buildCrimeMapUrl(address) {
    return (
      'https://chicagopd.maps.arcgis.com/apps/webappviewer/index.html?id=96ca65e89cd54b8c808b136a66778369&find=' +
      encodeURIComponent(address)
    );
  }

  async showLocation(event) {
    const query = this.address;
    if (query) {
      // We actually searched an address here, so don't show the geolocation marker anymore
      this.removePreviousGeoLocationMarkers();

      $('#address-search').find('input[name="address"]').val(query);
      window.location.hash = '#location_query=' + encodeURIComponent(query);
    }
    this.metrics.trackEvent({
      category: 'Tools',
      action: 'Looks up address',
      label: query || 'Geolocation',
    });

    this.location = await this.addressLookup.generateLocationDataForAddress(
      this.layers,
      event.location.raw
    );
    this.location_approximate = ['RANGE_INTERPOLATED', 'APPROXIMATE'].includes(
      event.location.raw.geometry.location_type
    );
    const randomInt = Math.round(Math.random() * 1000); // Without this, the iframe would not reload when we change locations
    this.wazeIframeUrl =
      'https://embed.waze.com/iframe?zoom=15&lat=' +
      this.location.meta.latitude +
      '&lon=' +
      this.location.meta.longitude +
      '&pin=1&_=' +
      randomInt;
    if (this.location.meta.inChicago) {
      this.crimereportsIframeUrl = this.buildCrimeMapUrl(
        this.location.meta.formattedAddress
      );

      schedule('afterRender', () => {
        const tooltipTriggerList = [].slice.call(
          document.querySelectorAll('[data-bs-toggle="tooltip"]')
        );
        tooltipTriggerList.map(function (tooltipTriggerEl) {
          return new bootstrap.Tooltip(tooltipTriggerEl);
        });
      });
    }
  }

  initGeocoder() {
    this.geosearchProvider = new GeoSearch.LegacyGoogleProvider({
      params: {
        key: 'REDACTED_PUBLIC_CREDENTIAL',
        bounds: '41.6,-87.9|42,-87.5',
      },
    });
    const searchControl = new GeoSearch.SearchControl({
      provider: this.geosearchProvider,
      style: 'button',
    });
    this.searchControl = searchControl;

    this.map.addControl(searchControl);

    this.map.on('geosearch/showlocation', this.showLocation.bind(this));
  }

  initLayers() {
    this.layers = {
      fireStations: {
        label: 'Fire Stations',
        layer: null,
        url: '/data/city_data/fire_stations.json',
        showByDefault: true,
      },
      policeDistricts: {
        label: 'Police Districts',
        layer: null,
        url: '/data/map_data/police_districts.geojson',
        showByDefault: true,
        propMappings: {
          dist_num: 'Police District',
        },
        style: {
          fill: true,
          fillOpacity: 0.01,
          color: '#00f',
          weight: 3,
        },
      },
      policeBeats: {
        label: 'Police Beats',
        layer: null,
        url: '/data/map_data/police_beats.geojson',
        showByDefault: false,
        propMappings: {
          district: 'Police District',
          beat_num: 'Police Beat',
        },
        style: {
          fill: true,
          fillOpacity: 0.05,
          color: '#00f',
          weight: 2,
        },
      },
      neighborhoods: {
        label: 'Neighborhoods',
        layer: null,
        url: '/data/map_data/neighborhoods_v2.geojson',
        showByDefault: false,
        propMappings: {
          PRI_NEIGH: 'Neighborhood',
        },
        style: {
          fill: true,
          fillOpacity: 0.05,
          color: '#a00',
          weight: 2,
        },
      },
      communityAreas: {
        label: 'Community Areas',
        layer: null,
        url: '/data/map_data/community_areas.geojson',
        showByDefault: false,
        propMappings: {
          community: 'Community Area',
        },
        style: {
          fill: true,
          fillOpacity: 0.05,
          color: '#333',
          weight: 3,
        },
      },
      wards: {
        label: 'Wards',
        layer: null,
        url: '/data/map_data/wards_2023.geojson',
        showByDefault: false,
        propMappings: {
          ward_id: 'Ward',
        },
        style: {
          fill: true,
          fillOpacity: 0.05,
          color: '#030',
          weight: 2,
        },
      },
      municipalities: {
        label: 'Municipalities',
        layer: null,
        url: '/data/map_data/municipalities.geojson',
        showByDefault: false,
        propMappings: {
          AGENCY_DESC: 'Jurisdiction',
        },
        style: {
          fill: true,
          fillOpacity: 0.05,
          color: '#3A0',
          weight: 2,
        },
      },
      gangs: {
        label: 'Gangs (unofficial)',
        layer: null,
        // https://www.google.com/maps/d/kml?forcekml=1&mid=1am7PF0tT25EztnOTAgUEL2E382VjVTc7
        url: '/data/map_data/gangs.kml',
        showByDefault: false,
      },
    };

    return this.loadLayerData(this.layers);
  }

  async loadLayerData(layers) {
    for (const layerName in layers) {
      if (Object.prototype.hasOwnProperty.call(layers, layerName)) {
        const layerObj = layers[layerName];

        if (layerName === 'fireStations') {
          const layerGroup = L.markerClusterGroup({
            showCoverageOnHover: false,
          });
          if (layerObj.showByDefault) {
            layerGroup.addTo(this.map);
          }
          layerObj.layer = layerGroup;
          this.layersControl.addOverlay(layerObj.layer, layerObj.label);
          const data = await (await fetch(layerObj.url)).json();

          data.forEach((location) => {
            const markerTitle = location.name
              ? location.name
              : [location.engine, location.truck, location.ambo, location.squad]
                  .filter(Boolean)
                  .join('-');

            const stationMarker = L.marker(
              [location.latitude, location.longitude],
              {
                title: markerTitle,
                icon: L.divIcon({
                  iconSize: [35, 45],
                  iconAnchor: [17, 42],
                  popupAnchor: [1, -32],
                  shadowAnchor: [10, 12],
                  shadowSize: [36, 16],
                  className: 'awesome-marker-icon-red awesome-marker',
                  html: '<svg class="svg-inline--fa fa-fire-extinguisher" data-prefix="fas" data-icon="fire-extinguisher" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="color: #fff;font-size: 1rem;margin-top: 10px;"><path fill="currentColor" d="M500.3 7.3C507.7 13.3 512 22.4 512 32v96c0 9.6-4.3 18.7-11.7 24.7s-17.2 8.5-26.6 6.6l-160-32C301.5 124.9 292 115.7 289 104H224v34.8c37.8 18 64 56.5 64 101.2V384H64V240c0-44.7 26.2-83.2 64-101.2V110c-36.2 11.1-66 36.9-82.3 70.5c-5.8 11.9-20.2 16.9-32.1 11.1S-3.3 171.4 2.5 159.5C26.7 109.8 72.7 72.6 128 60.4V32c0-17.7 14.3-32 32-32h32c17.7 0 32 14.3 32 32V56h65c3-11.7 12.5-20.9 24.7-23.4l160-32c9.4-1.9 19.1 .6 26.6 6.6zM288 416v32c0 35.3-28.7 64-64 64H128c-35.3 0-64-28.7-64-64V416H288zM176 96c8.8 0 16-7.2 16-16s-7.2-16-16-16s-16 7.2-16 16s7.2 16 16 16z"></path></svg>',
                }),
              }
            );

            // Convert address to title case
            location.addr = location.addr
              .toLowerCase()
              .replace(/(?:^|\s|-|\/)\S/g, function (m) {
                return m.toUpperCase();
              });

            // this is a really hacky way to make a popup, we should stop doing it
            // @TODO: Use Handlebars template to make Leaflet popup
            const popupContents =
              '<h6>' +
              markerTitle +
              '</h6>' +
              '<strong>' +
              location.addr +
              '</strong>' +
              (location.engine
                ? '<br><strong>Engine:</strong> ' + location.engine
                : '') +
              (location.truck
                ? '<br><strong>Truck/Tower:</strong> ' + location.truck
                : '') +
              (location.ambo
                ? '<br><strong>Ambulance:</strong> ' + location.ambo
                : '') +
              (location.squad
                ? '<br><strong>Squad:</strong> ' + location.squad
                : '') +
              (location.special
                ? '<br><strong>Special (search radio IDs):</strong> ' +
                  location.special
                : '') +
              (location.batt
                ? '<br><strong>Battalion:</strong> ' +
                  location.batt +
                  ' / <strong>District:</strong> ' +
                  location.fireDist
                : '') +
              (location.emsDist
                ? '<br><strong>EMS District:</strong> ' + location.emsDist
                : '') +
              (location.radio
                ? '<br><strong>Radio Channel:</strong> ' + location.radio
                : '');
            stationMarker.bindPopup(popupContents).openPopup();

            layerGroup.addLayer(stationMarker);
          });
        } else if (layerName === 'gangs') {
          const kmlLayer = new L.KML();
          this.map.attributionControl.addAttribution(
            'Gang map by <a href="https://np.reddit.com/r/Chiraqology/wiki/index/gangmaps" target="_blank">u/ReggieG45</a>'
          );
          if (layerObj.showByDefault) {
            kmlLayer.addTo(this.map);
          }
          layerObj.layer = kmlLayer;
          this.layersControl.addOverlay(layerObj.layer, layerObj.label);

          const response = await fetch(layerObj.url);
          const kmltext = await response.text();
          // Create new kml overlay
          const parser = new DOMParser();
          const kml = parser.parseFromString(kmltext, 'text/xml');
          layerObj.layer.addKML(kml);
        } else {
          const geoJsonLayer = L.geoJson(null, {
            onEachFeature: (feature, layer) => {
              const props = {};
              for (const key in feature.properties) {
                if (
                  Object.prototype.hasOwnProperty.call(
                    layerObj.propMappings,
                    key
                  )
                ) {
                  props[layerObj.propMappings[key]] = feature.properties[key];
                }
              }
              feature.properties = props;
            },
          });
          if (layerObj.showByDefault) {
            geoJsonLayer.addTo(this.map);
          }
          layerObj.layer = geoJsonLayer;
          this.layersControl.addOverlay(layerObj.layer, layerObj.label);
          const data = await (await fetch(layerObj.url)).json();
          layerObj.layer.addData(data).setStyle(layerObj.style);
        }
      }
    }
  }

  initInfoBox() {
    this.infobox = L.control();

    this.infobox.onAdd = function () {
      this._div = L.DomUtil.create('div', 'info');
      this.update();
      return this._div;
    };

    this.infobox.update = function (props) {
      let html = '<h4>Layer Info</h4>';
      if (props && Object.keys(props).length) {
        for (const key in props) {
          html += '<p><em>' + key + '</em>: ' + props[key] + '</p>';
        }
      } else {
        html += '<p>Hover/tap a layer</p>';
      }
      this._div.innerHTML = html;
    };

    this.infobox.addTo(this.map);

    const onMouseMove = (e) => {
      const allProps = {};

      if (this.layersControl._layers) {
        this.layersControl._layers.forEach((obj) => {
          if (obj.layer && typeof obj.layer.eachLayer === 'function') {
            const result = leafletPip.pointInLayer(
              e.latlng,
              obj.layer,
              true
            )[0];
            if (result) {
              Object.assign(allProps, result.feature.properties);
            }
          }
        });
      }
      this.infobox.update(allProps);

      if (e.type === 'click') {
        L.popup()
          .setLatLng(e.latlng)
          .setContent(this.infobox._div.innerHTML)
          .openOn(this.map);
      }
    };

    this.map.on('mousemove', (e) => {
      if (e.originalEvent.buttons === 0) {
        debounce(this, onMouseMove, e, 2, true);
      }
    });

    this.map.on('click', onMouseMove);
  }

  initEditableMap() {
    this.editableLayer = L.markerClusterGroup().addTo(this.map);
    this.layersControl.addOverlay(this.editableLayer, 'User Features');

    this.map.addControl(
      new L.Control.Draw({
        edit: {
          featureGroup: this.editableLayer,
          poly: {
            allowIntersection: false,
          },
        },
        draw: {
          polyline: {
            shapeOptions: {
              color: '#00ff00',
              weight: 10,
            },
          },
          polygon: {
            showArea: true,
            allowIntersection: false,
            drawError: {
              color: '#da2600', // Color the shape will turn when intersects
              message:
                '<strong>Error:<strong> Polygon cannot intersect with itself', // Message that will show when intersect
            },
            shapeOptions: {
              color: '#00ff00',
            },
          },
        },
      })
    );

    const drawEventCreated = (event) => {
      const layer = event.layer;
      // layer.bindPopup('<button type="button" class="btn btn-primary" data-toggle="modal" data-target="#add-incident-modal">Add Incident</button>').openPopup();

      this.editableLayer.addLayer(layer);
    };

    this.map.on(L.Draw.Event.CREATED, drawEventCreated.bind(this));
  }
}
