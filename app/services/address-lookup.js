/*global leafletPip*/

import Service from '@ember/service';
import { set } from '@ember/object';
import fetch from 'fetch';

export default Service.extend({
  loadData() {
    return Promise.all([
      new Promise((resolve) => {
        this.policeZones = {'1': ['16', '17'], '2': ['19'], '3': ['12', '14'], '4': ['1', '18'], '5': ['2'], '6': ['7', '8'], '7': ['3'], '8': ['4', '6'], '9': ['5', '22'], '10': ['10', '11'], '11': ['20', '24'], '12': ['15', '25'], '13': ['9']};
        resolve();
      }),
      new Promise((resolve) => {
        this.policeAreas = {'North': ['11', '14', '15', '16', '17', '19', '20', '24'], 'Central': ['1', '2', '3', '8', '9', '10', '12', '18'], 'South': ['4', '5', '6', '7', '22']};
        resolve();
      }),
      new Promise((resolve, reject) => {
        fetch('https://crimeisdown.com/data/city_data/aldermen.json').then((response) => {
          response.json().then((data) => {
            this.aldermen = data;
            resolve(data);
          }).catch((err) => {
            reject(err);
          });
        }).catch((err) => {
          reject(err);
        });
      }),
      new Promise((resolve, reject) => {
        fetch('https://crimeisdown.com/data/audio_data/online_streams.json').then((response) => {
          response.json().then((data) => {
            this.onlineStreams = data;
            resolve(data);
          }).catch((err) => {
            reject(err);
          });
        }).catch((err) => {
          reject(err);
        });
      }),
      new Promise((resolve, reject) => {
        fetch('https://crimeisdown.com/data/city_data/fire_stations.json').then((response) => {
          response.json().then((data) => {
            this.fireStations = data;
            resolve(data);
          }).catch((err) => {
            reject(err);
          });
        }).catch((err) => {
          reject(err);
        });
      }),
      new Promise((resolve, reject) => {
        fetch('https://crimeisdown.com/data/city_data/trauma_centers.json').then((response) => {
          response.json().then((data) => {
            this.traumaCenters = data;
            resolve(data);
          }).catch((err) => {
            reject(err);
          });
        }).catch((err) => {
          reject(err);
        });
      })
    ]);
  },

  generateLocationDataForAddress(layers, location) {
    let result = {};

    let latlng = L.latLng(location.geometry.location.lat, location.geometry.location.lng);

    result.meta = this.buildMeta(layers, location.formatted_address, latlng);

    if (!result.meta.communityArea) {
      result.meta.formattedAddress = 'ADDRESS OUT OF BOUNDS: '+result.meta.formattedAddress;
    } else {
      result.police = this.buildPolice(layers, latlng);
      result.fire = this.buildFire(latlng);
      result.ems = this.buildEMS(latlng);
    }

    return result;
  },

  buildMeta(layers, address, location) {
    let meta = {
      formattedAddress: address,
      latitude: location.lat.toFixed(6),
      longitude: location.lng.toFixed(6)
    };

    if (layers.hasOwnProperty('communityAreas')) {
      let result = leafletPip.pointInLayer(location, layers.communityAreas.layer, true)[0];
      if (result) {
        meta.communityArea = result.feature.properties.community;
      }
    }

    if (layers.hasOwnProperty('neighborhoods')) {
      let result = leafletPip.pointInLayer(location, layers.neighborhoods.layer, true)[0];
      if (result) {
        meta.neighborhood = result.feature.properties.pri_neigh;
      }
    }

    if (layers.hasOwnProperty('wards')) {
      let result = leafletPip.pointInLayer(location, layers.wards.layer, true)[0];
      if (result) {
        meta.ward = result.feature.properties.ward;
        meta.alderman = this.aldermen[parseInt(result.feature.properties.ward)-1];
      }
    }

    return meta;
  },

  buildPolice(layers, location) {
    let police = {};

    if (layers.hasOwnProperty('policeDistricts')) {
      let result = leafletPip.pointInLayer(location, layers.policeDistricts.layer, true)[0];
      if (result) {
        police.district = result.feature.properties.dist_label.toLowerCase();

        for (let key in this.policeZones) {
          if (this.policeZones[key].includes(result.feature.properties.dist_num)) {
            this.onlineStreams.forEach((stream) => {
              if ('Z' + key === stream.key) {
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
      let result = leafletPip.pointInLayer(location, layers.policeBeats.layer, true)[0];
      if (result) {
        police.beat = result.feature.properties.beat_num;
      }
    }

    return police;
  },

  buildFire(location) {
    let nearestEngine = {distance: 99999999};
    let nearestAmbo = {distance: 99999999};

    this.fireStations.forEach((station) => {
      let distance = location.distanceTo(L.latLng(station.latitude, station.longitude));
      if (station.engine.length && nearestEngine.distance > distance) {
        nearestEngine = station;
        set(nearestEngine, 'distance', distance);
      }
      if (station.ambo.length && nearestAmbo.distance > distance) {
        nearestAmbo = station;
        set(nearestAmbo, 'distance', distance);
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

  buildEMS(location) {
    let nearestTraumaAdult = {distance: 99999999};
    let nearestTraumaPed = {distance: 99999999};

    this.traumaCenters.forEach((hospital) => {
      let distance = location.distanceTo(L.latLng(hospital.latitude, hospital.longitude));
      if (hospital.level1Adult && nearestTraumaAdult.distance > distance) {
        nearestTraumaAdult = hospital;
        set(nearestTraumaAdult, 'distance', distance);
        set(nearestTraumaAdult, 'distanceMi', Math.round(distance*0.000621371192*100)/100);
      }
      if (hospital.level1Ped && nearestTraumaPed.distance > distance) {
        nearestTraumaPed = hospital;
        set(nearestTraumaPed, 'distance', distance);
        set(nearestTraumaPed, 'distanceMi', Math.round(distance*0.000621371192*100)/100);
      }
    });

    return {
      nearestTraumaAdult: nearestTraumaAdult,
      nearestTraumaPed: nearestTraumaPed
    };
  }
});
