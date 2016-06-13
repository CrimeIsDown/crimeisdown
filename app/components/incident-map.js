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

    var info = L.control();

    info.onAdd = function (map) {
      this._div = L.DomUtil.create('div', 'info');
      this.update();
      return this._div;
    };

    info.update = function (props) {
      let html = '<h4>Layer Info</h4><ul>';
      for (let key in props) {
        if (props.hasOwnProperty(key) && key === key.toUpperCase()) {
          html += '<li>' + key + ': ' + props[key] + '</li>';
        }
      }
      html += '</ul>';
      this._div.innerHTML = html;
    };

    info.addTo(map);

    let layers = {
      policeDistricts: {
        label: "Police Districts",
        layer: null,
        url: '/data/map_data/police_districts.json',
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
        url: '/data/map_data/police_beats.json',
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
        url: '/data/map_data/neighborhoods.json',
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
        url: '/data/map_data/community_areas.json',
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
        url: '/data/map_data/wards.json',
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

                layer.setStyle({
                  color: '#ff0',
                  fillOpacity: 0.4
                });

                if (!L.Browser.ie && !L.Browser.opera) {
                  layer.bringToFront();
                }

                info.update(layer.feature.properties);
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
      "OpenStreetMap": osm
    }, overlay, {
      collapse: false
    }).addTo(map);
  }
});
