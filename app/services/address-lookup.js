/*global leafletPip*/

import Service from '@ember/service';
import { set } from '@ember/object';
import fetch from 'fetch';

export default class AddressLookup extends Service {
  policeZones = {
    1: ['16', '17'],
    2: ['19'],
    3: ['12', '14'],
    4: ['1', '18'],
    6: ['7', '8'],
    7: ['2', '3'],
    8: ['4', '6'],
    9: ['5', '22'],
    10: ['10', '11'],
    11: ['20', '24'],
    12: ['15', '25'],
    13: ['9'],
  };
  policeAreas = {
    North: ['11', '14', '15', '16', '17', '19', '20', '24'],
    Central: ['1', '2', '3', '8', '9', '10', '12', '18'],
    South: ['4', '5', '6', '7', '22'],
  };
  onlineStreams = [];
  aldermen = [];
  fireStations = [];
  traumaCenters = [];

  constructor() {
    super(...arguments);
    this.dataLoadedPromise = this.loadData();
  }

  async loadData() {
    this.onlineStreams = await (
      await fetch('/data/audio_data/online_streams.json')
    ).json();
    this.aldermen = await (await fetch('/data/city_data/aldermen.json')).json();
    this.fireStations = await (
      await fetch('/data/city_data/fire_stations.json')
    ).json();
    this.traumaCenters = await (
      await fetch('/data/city_data/trauma_centers.json')
    ).json();

    return true;
  }

  async generateLocationDataForAddress(layers, location) {
    let result = {};

    let latlng = L.latLng(
      location.geometry.location.lat(),
      location.geometry.location.lng()
    );

    result.meta = {
      formattedAddress: location.formatted_address,
      latitude: latlng.lat.toFixed(6),
      longitude: latlng.lng.toFixed(6),
    };

    await this.dataLoadedPromise;

    result.meta = this.buildMeta(layers, location.formatted_address, latlng);

    if (!result.meta.communityArea) {
      result.meta.formattedAddress =
        result.meta.formattedAddress +
        ' (Not in Chicago, no additional location info available)';
      result.meta.inChicago = false;
    } else {
      result.meta.inChicago = true;
      result.police = this.buildPolice(layers, latlng);
      result.fire = this.buildFire(latlng);
      result.ems = this.buildEMS(latlng);
    }

    return result;
  }

  buildMeta(layers, address, location) {
    let meta = {
      formattedAddress: address,
      latitude: location.lat.toFixed(6),
      longitude: location.lng.toFixed(6),
    };

    if (Object.prototype.hasOwnProperty.call(layers, 'communityAreas')) {
      let result = leafletPip.pointInLayer(
        location,
        layers.communityAreas.layer,
        true
      )[0];
      if (result) {
        meta.communityArea = result.feature.properties['Community Area'];
        // Convert to title case instead of all caps
        meta.communityArea = meta.communityArea
          .toLowerCase()
          .replace(/(?:^|\s|-|\/)\S/g, function (m) {
            return m.toUpperCase();
          });
      }
    }

    if (Object.prototype.hasOwnProperty.call(layers, 'neighborhoods')) {
      let result = leafletPip.pointInLayer(
        location,
        layers.neighborhoods.layer,
        true
      )[0];
      if (result) {
        meta.neighborhood = result.feature.properties['Neighborhood'];
      }
    }

    if (Object.prototype.hasOwnProperty.call(layers, 'wards')) {
      let result = leafletPip.pointInLayer(
        location,
        layers.wards.layer,
        true
      )[0];
      if (result) {
        meta.ward = result.feature.properties['Ward'];
        meta.alderman = this.aldermen[parseInt(meta.ward) - 1];
      }
    }

    return meta;
  }

  buildPolice(layers, location) {
    let police = {};

    if (Object.prototype.hasOwnProperty.call(layers, 'policeDistricts')) {
      let result = leafletPip.pointInLayer(
        location,
        layers.policeDistricts.layer,
        true
      )[0];
      if (result) {
        police.district =
          result.feature.properties['Police District'].toLowerCase();

        for (let key in this.policeZones) {
          if (this.policeZones[key].includes(police.district)) {
            this.onlineStreams.forEach((stream) => {
              if ('zone' + key === stream.slug) {
                police.zone = stream;
                police.zone.num = key;
              }
            });
          }
        }
        for (let key in this.policeAreas) {
          if (this.policeAreas[key].includes(police.district)) {
            police.area = key;
          }
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(layers, 'policeBeats')) {
      let result = leafletPip.pointInLayer(
        location,
        layers.policeBeats.layer,
        true
      )[0];
      if (result) {
        police.beat = result.feature.properties['Police Beat'];
      }
    }

    return police;
  }

  buildFire(location) {
    let nearestEngine = { distance: 99999999 };
    let nearestTruck = { distance: 99999999 };
    let nearestSquad = { distance: 99999999 };
    let nearestAmbo = { distance: 99999999 };

    this.fireStations.forEach((station) => {
      let distance = location.distanceTo(
        L.latLng(station.latitude, station.longitude)
      );
      if (station.engine.length && nearestEngine.distance > distance) {
        nearestEngine = station;
        set(nearestEngine, 'distance', distance);
      }
      if (station.truck.length && nearestTruck.distance > distance) {
        nearestTruck = station;
        set(nearestTruck, 'distance', distance);
      }
      if (station.squad.length && nearestSquad.distance > distance) {
        nearestSquad = station;
        set(nearestSquad, 'distance', distance);
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
      nearestAmbo: nearestAmbo,
      nearestEngine: nearestEngine,
      nearestTruck: nearestTruck,
      nearestSquad: nearestSquad,
    };
  }

  buildEMS(location) {
    let nearestTraumaAdult = { distance: 99999999 };
    let nearestTraumaPed = { distance: 99999999 };

    this.traumaCenters.forEach((hospital) => {
      let distance = location.distanceTo(
        L.latLng(hospital.latitude, hospital.longitude)
      );
      if (hospital.level1Adult && nearestTraumaAdult.distance > distance) {
        nearestTraumaAdult = hospital;
        set(nearestTraumaAdult, 'distance', distance);
        set(
          nearestTraumaAdult,
          'distanceMi',
          Math.round(distance * 0.000621371192 * 100) / 100
        );
      }
      if (hospital.level1Ped && nearestTraumaPed.distance > distance) {
        nearestTraumaPed = hospital;
        set(nearestTraumaPed, 'distance', distance);
        set(
          nearestTraumaPed,
          'distanceMi',
          Math.round(distance * 0.000621371192 * 100) / 100
        );
      }
    });

    return {
      nearestTraumaAdult: nearestTraumaAdult,
      nearestTraumaPed: nearestTraumaPed,
    };
  }

  findStation(query = '') {
    query = query.toUpperCase();
    let HQ = ' (HQ)';
    let results = [];
    this.fireStations.forEach((station) => {
      let searchable = [];
      if (station.engine) {
        searchable = searchable.concat(station.engine.split(/, ?/));
      }
      if (station.truck) {
        searchable = searchable.concat(station.truck.split(/, ?/));
      }
      if (station.ambo) {
        searchable = searchable.concat(station.ambo.split(/, ?/));
      }
      if (station.special) {
        searchable = searchable.concat(station.special.split(/, ?/));
      }
      if (station.squad) {
        searchable.push(station.squad.substring(0, station.squad.indexOf('/')));
      }
      if (station.batt.indexOf(HQ)) {
        searchable.push(
          'BC' + station.batt.substring(0, station.batt.indexOf(HQ))
        );
      }
      if (station.fireDist.indexOf(HQ)) {
        searchable.push(
          '2-2-' + station.fireDist.substring(0, station.fireDist.indexOf(HQ))
        );
      }
      if (station.emsDist.indexOf(HQ)) {
        searchable.push(
          '4-5-' + station.emsDist.substring(0, station.emsDist.indexOf(HQ))
        );
      }

      if (searchable.indexOf(query) !== -1) {
        results.push(station);
      }
    });
    return results;
  }
}
