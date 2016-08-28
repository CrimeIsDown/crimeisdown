import Ember from 'ember';

export default Ember.Service.extend({
  loadData() {
    Ember.$.getJSON('/data/city_data/aldermen.json').done((data) => {
      this.aldermen = data;
    });
    Ember.$.getJSON('/data/audio_data/online_streams.json').done((data) => {
      this.onlineStreams = data;
    });
    Ember.$.getJSON('/data/city_data/fire_stations.json').done((data) => {
      this.fireStations = data;
    });
    Ember.$.getJSON('/data/city_data/trauma_centers.json').done((data) => {
      this.traumaCenters = data;
    });

    this.policeZones = {'1': ['16', '17'], '2': ['19'], '3': ['12', '14'], '4': ['1', '18'], '5': ['2'], '6': ['7', '8'], '7': ['3'], '8': ['4', '6'], '9': ['5', '22'], '10': ['10', '11'], '11': ['20', '24'], '12': ['15', '25'], '13': ['9']};
    this.policeAreas = {'North': ['11', '14', '15', '16', '17', '19', '20', '24'], 'Central': ['1', '2', '3', '8', '9', '10', '12', '18'], 'South': ['4', '5', '6', '7', '22']};
  },

  generateLocationDataForAddress(layers, e) {
    let location = {};

    location.meta = this.buildMeta(layers, e.geocode);
    location.police = this.buildPolice(layers, e.geocode);
    location.fire = this.buildFire(e.geocode);
    location.ems = this.buildEMS(e.geocode);

    return location;
  },

  buildMeta(layers, geocode) {
    let meta = {
      formattedAddress: geocode.name,
      latitude: geocode.center.lat.toFixed(6),
      longitude: geocode.center.lng.toFixed(6)
    };

    if (layers.hasOwnProperty('communityAreas')) {
      let result = leafletPip.pointInLayer(geocode.center, layers.communityAreas.layer, true)[0];
      if (result) {
        meta.communityArea = result.feature.properties.community;
      }
    }

    if (layers.hasOwnProperty('neighborhoods')) {
      let result = leafletPip.pointInLayer(geocode.center, layers.neighborhoods.layer, true)[0];
      if (result) {
        meta.neighborhood = result.feature.properties.pri_neigh;
      }
    }

    if (layers.hasOwnProperty('wards')) {
      let result = leafletPip.pointInLayer(geocode.center, layers.wards.layer, true)[0];
      if (result) {
        meta.ward = result.feature.properties.ward;
        meta.alderman = this.aldermen[parseInt(result.feature.properties.ward)-1];
      }
    }

    return meta;
  },

  buildPolice(layers, geocode) {
    let police = {};

    if (layers.hasOwnProperty('policeDistricts')) {
      let result = leafletPip.pointInLayer(geocode.center, layers.policeDistricts.layer, true)[0];
      if (result) {
        police.district = result.feature.properties.dist_label.toLowerCase();

        for (let key in this.policeZones) {
          if (this.policeZones[key].includes(result.feature.properties.dist_num)) {
            this.onlineStreams.forEach((stream) => {
              if ('Z' + key == stream.key) {
                police.zone = {num: key, freq: stream.frequency, url: stream.feedUrl, mp3: stream.directStreamUrl};
              }
            });
          }
        }
        for (let key in this.policeAreas) {
          if (this.policeAreas[key].includes(result.feature.properties.dist_num)) {
            police.area = key;
          }
        }
      }
    }

    if (layers.hasOwnProperty('policeBeats')) {
      let result = leafletPip.pointInLayer(geocode.center, layers.policeBeats.layer, true)[0];
      if (result) {
        police.beat = result.feature.properties.beat_num;
      }
    }

    return police;
  },

  buildFire(geocode) {
    let nearestEngine = {distance: 99999999};
    let nearestAmbo = {distance: 99999999};

    this.fireStations.forEach((station) => {
      let distance = geocode.center.distanceTo(L.latLng(station.latitude, station.longitude));
      if (station.engine.length && nearestEngine.distance > distance) {
        nearestEngine = station;
        Ember.set(nearestEngine, 'distance', distance);
      }
      if (station.ambo.length && nearestAmbo.distance > distance) {
        nearestAmbo = station;
        Ember.set(nearestAmbo, 'distance', distance);
      }
    });

    return {
      battalion: nearestEngine.batt.replace(' (HQ)', ''),
      channel: nearestEngine.radio,
      emsDistrict: nearestEngine.emsDist.replace(' (HQ)', ''),
      fireDistrict: nearestEngine.fireDist.replace(' (HQ)', ''),
      nearestAmbo: nearestAmbo.ambo,
      nearestEngine: nearestEngine.engine
    };
  },

  buildEMS(geocode) {
    let nearestTraumaAdult = {distance: 99999999};
    let nearestTraumaPed = {distance: 99999999};

    this.traumaCenters.forEach((hospital) => {
      let distance = geocode.center.distanceTo(L.latLng(hospital.latitude, hospital.longitude));
      if (hospital.level1Adult && nearestTraumaAdult.distance > distance) {
        nearestTraumaAdult = hospital;
        Ember.set(nearestTraumaAdult, 'distance', distance);
        Ember.set(nearestTraumaAdult, 'distanceMi', Math.round(distance*0.000621371192*100)/100);
      }
      if (hospital.level1Ped && nearestTraumaPed.distance > distance) {
        nearestTraumaPed = hospital;
        Ember.set(nearestTraumaPed, 'distance', distance);
        Ember.set(nearestTraumaPed, 'distanceMi', Math.round(distance*0.000621371192*100)/100);
      }
    });

    return {
      nearestTraumaAdult: nearestTraumaAdult,
      nearestTraumaPed: nearestTraumaPed
    };
  }
});
