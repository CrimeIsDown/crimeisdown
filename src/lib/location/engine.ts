import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

import { POLICE_AREAS, POLICE_ZONES } from "@/lib/location/constants";
import { loadLookupDatasets } from "@/lib/location/data";
import type {
  AssetTextFetcher,
  Coordinate,
  FireStation,
  LocationContextResult,
  LookupRequest,
  StreamInfo,
  TraumaCenter,
} from "@/lib/location/types";

type GeocodeResult = {
  formattedAddress: string;
  lat: number;
  lng: number;
  approximate?: boolean;
};

function titleCase(value?: string | null) {
  if (!value) {
    return undefined;
  }

  return value
    .toLowerCase()
    .replace(/(?:^|\s|-|\/)\S/g, (match) => match.toUpperCase());
}

function normalizeDistrict(value?: string | number) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value).replace(/^0+/, "") || "0";
}

function haversineDistanceMeters(a: Coordinate, b: Coordinate) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function findContainingFeature(
  collection: FeatureCollection<Polygon | MultiPolygon>,
  coordinate: Coordinate,
) {
  const candidate = point([coordinate.lng, coordinate.lat]);
  return collection.features.find((feature) =>
    booleanPointInPolygon(candidate, feature),
  );
}

function findNearestStation(
  coordinate: Coordinate,
  stations: FireStation[],
  accessor: (station: FireStation) => string,
) {
  let nearest: FireStation | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const station of stations) {
    if (!accessor(station)) {
      continue;
    }

    const distance = haversineDistanceMeters(coordinate, {
      lat: Number(station.latitude),
      lng: Number(station.longitude),
    });

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = {
        ...station,
        distance,
        distanceMi: Math.round(distance * 0.000621371192 * 100) / 100,
      };
    }
  }

  return nearest;
}

function findNearestTrauma(
  coordinate: Coordinate,
  hospitals: TraumaCenter[],
  key: "level1Adult" | "level1Ped",
) {
  let nearest: TraumaCenter | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const hospital of hospitals) {
    if (!hospital[key]) {
      continue;
    }

    const distance = haversineDistanceMeters(coordinate, {
      lat: Number(hospital.latitude),
      lng: Number(hospital.longitude),
    });

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = {
        ...hospital,
        distance,
        distanceMi: Math.round(distance * 0.000621371192 * 100) / 100,
      };
    }
  }

  return nearest;
}

function findZone(streams: StreamInfo[], district?: string) {
  if (!district) {
    return undefined;
  }

  for (const [zoneNum, districts] of Object.entries(POLICE_ZONES)) {
    if (!districts.includes(district)) {
      continue;
    }

    const stream = streams.find((candidate) => candidate.slug === `zone${zoneNum}`);
    if (stream) {
      return { ...stream, num: zoneNum };
    }
  }

  return undefined;
}

function findArea(district?: string) {
  if (!district) {
    return undefined;
  }

  for (const [area, districts] of Object.entries(POLICE_AREAS)) {
    if (districts.includes(district)) {
      return area;
    }
  }

  return undefined;
}

async function geocodeLocation(query: string | Coordinate, key?: string): Promise<GeocodeResult> {
  if (!key) throw new Error("Location search is temporarily unavailable. Please try again.");
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("key", key);
  if (typeof query === "string") {
    url.searchParams.set("address", query);
    url.searchParams.set("bounds", "41.6,-87.9|42,-87.5");
  } else {
    url.searchParams.set("latlng", `${query.lat},${query.lng}`);
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Location search is temporarily unavailable. Please try again.");
  const payload = await response.json() as {
    status: string;
    results?: { formatted_address: string; geometry: { location: Coordinate; location_type?: string } }[];
  };
  if (payload.status === "ZERO_RESULTS") throw new Error("The location entered could not be found. Please try again with a different address or intersection.");
  if (payload.status !== "OK" || !payload.results?.length) throw new Error("Location search is temporarily unavailable. Please try again.");
  const match = payload.results[0];
  return {
    formattedAddress: match.formatted_address,
    // Reverse geocoding must not move a device's coordinates to the nearest building.
    ...(typeof query === "string" ? match.geometry.location : query),
    approximate: ["RANGE_INTERPOLATED", "APPROXIMATE"].includes(match.geometry.location_type || ""),
  };
}

export function findStation(query: string, stations: FireStation[]) {
  const normalized = query.trim().toUpperCase();
  return stations.find((station) => {
    const aliases = [station.engine, station.truck, station.ambo, station.special]
      .flatMap((value) => value.split(/,\s*/));
    if (station.squad) aliases.push(station.squad.split("/")[0]);
    for (const [value, prefix] of [[station.batt, "BC"], [station.fireDist, "2-2-"], [station.emsDist, "4-5-"]]) {
      if (value.endsWith(" (HQ)")) aliases.push(prefix + value.replace(" (HQ)", ""));
    }
    return aliases.some((alias) => alias && alias.toUpperCase() === normalized);
  });
}

function createHttpAssetTextFetcher(origin: string): AssetTextFetcher {
  return async (path) => {
    const response = await fetch(new URL(path, origin));
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: ${response.status}`);
    }

    return response.text();
  };
}

export async function lookupLocationContext({
  origin,
  q,
  lat,
  lng,
  assetText,
  googleGeocodingKey,
}: LookupRequest): Promise<LocationContextResult> {
  const datasets = await loadLookupDatasets(
    assetText ?? createHttpAssetTextFetcher(origin),
  );

  let resolved: GeocodeResult;

  if (q?.trim()) {
    const station = findStation(q, datasets.fireStations);
    if (station) q = `${station.addr} ${station.zip}`;
    resolved = await geocodeLocation(q, googleGeocodingKey);
  } else if (lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    resolved = await geocodeLocation({ lat, lng }, googleGeocodingKey);
  } else {
    throw new Error("A query or valid coordinates are required.");
  }

  const coordinate = { lat: resolved.lat, lng: resolved.lng };
  const communityArea = findContainingFeature(datasets.communityAreas, coordinate);
  const neighborhood = findContainingFeature(datasets.neighborhoods, coordinate);
  const ward = findContainingFeature(datasets.wards, coordinate);
  const districtFeature = findContainingFeature(datasets.policeDistricts, coordinate);
  const beatFeature = findContainingFeature(datasets.policeBeats, coordinate);

  const wardId = ward ? String(ward.properties?.ward ?? "") : undefined;
  const district = normalizeDistrict(districtFeature?.properties?.dist_num);
  const beat = beatFeature ? String(beatFeature.properties?.beat_num ?? "") : undefined;
  const alderman = wardId
    ? datasets.aldermen.find((entry) => String(entry.ward) === wardId)
    : undefined;

  const zone = findZone(datasets.streams, district);
  const area = findArea(district);
  const inChicago = Boolean(communityArea);
  const nearestEngine = inChicago
    ? findNearestStation(coordinate, datasets.fireStations, (station) => station.engine)
    : undefined;
  const nearestTruck = inChicago
    ? findNearestStation(coordinate, datasets.fireStations, (station) => station.truck)
    : undefined;
  const nearestSquad = inChicago
    ? findNearestStation(coordinate, datasets.fireStations, (station) => station.squad)
    : undefined;
  const nearestAmbo = inChicago
    ? findNearestStation(coordinate, datasets.fireStations, (station) => station.ambo)
    : undefined;

  return {
    query: {
      q,
      lat,
      lng,
    },
    meta: {
      formattedAddress: resolved.formattedAddress + (inChicago ? "" : " (Not in Chicago, no additional location info available)"),
      approximate: resolved.approximate,
      latitude: coordinate.lat,
      longitude: coordinate.lng,
      inChicago,
      neighborhood: titleCase(
        String(
          neighborhood?.properties?.PRI_NEIGH ??
            neighborhood?.properties?.PRI_NEIGH_ ??
            "",
        ),
      ),
      communityArea: titleCase(
        String(communityArea?.properties?.community ?? ""),
      ),
      ward: wardId,
      alderman,
    },
    police: inChicago
      ? {
          district,
          beat,
          area,
          zone,
        }
      : undefined,
    fire: inChicago
      ? {
          battalion: nearestEngine?.batt?.replace(" (HQ)", ""),
          channel: nearestEngine?.radio,
          emsDistrict: nearestEngine?.emsDist?.replace(" (HQ)", ""),
          fireDistrict: nearestEngine?.fireDist?.replace(" (HQ)", ""),
          nearestEngine,
          nearestTruck,
          nearestSquad,
          nearestAmbo,
        }
      : undefined,
    ems: inChicago
      ? {
          nearestTraumaAdult: findNearestTrauma(coordinate, datasets.traumaCenters, "level1Adult"),
          nearestTraumaPed: findNearestTrauma(coordinate, datasets.traumaCenters, "level1Ped"),
        }
      : undefined,
  };
}
