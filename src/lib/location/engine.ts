import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

import { CHICAGO_VIEWBOX, POLICE_AREAS, POLICE_ZONES } from "@/lib/location/constants";
import { loadLookupDatasets } from "@/lib/location/data";
import type {
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
};

type NominatimSearchResult = {
  display_name: string;
  lat: string;
  lon: string;
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

async function geocodeAddress(origin: string, query: string): Promise<GeocodeResult> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("viewbox", CHICAGO_VIEWBOX);
  url.searchParams.set("bounded", "1");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": `${origin}/crimeisdown-v4`,
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoding request failed with ${response.status}`);
  }

  const results = (await response.json()) as NominatimSearchResult[];
  const match = results[0];

  if (!match) {
    throw new Error("No matching location found.");
  }

  return {
    formattedAddress: match.display_name,
    lat: Number(match.lat),
    lng: Number(match.lon),
  };
}

async function reverseGeocode(origin: string, coordinate: Coordinate) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(coordinate.lat));
  url.searchParams.set("lon", String(coordinate.lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("zoom", "18");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": `${origin}/crimeisdown-v4`,
    },
  });

  if (!response.ok) {
    return `Coordinates ${coordinate.lat.toFixed(5)}, ${coordinate.lng.toFixed(5)}`;
  }

  const payload = (await response.json()) as { display_name?: string };
  return payload.display_name || `Coordinates ${coordinate.lat.toFixed(5)}, ${coordinate.lng.toFixed(5)}`;
}

export async function lookupLocationContext({
  origin,
  q,
  lat,
  lng,
}: LookupRequest): Promise<LocationContextResult> {
  const datasets = loadLookupDatasets();

  let resolved: GeocodeResult;

  if (q) {
    resolved = await geocodeAddress(origin, q);
  } else if (lat !== undefined && lng !== undefined) {
    resolved = {
      formattedAddress: await reverseGeocode(origin, { lat, lng }),
      lat,
      lng,
    };
  } else {
    throw new Error("A query or coordinates are required.");
  }

  const coordinate = { lat: resolved.lat, lng: resolved.lng };
  const communityArea = findContainingFeature(datasets.communityAreas, coordinate);
  const neighborhood = findContainingFeature(datasets.neighborhoods, coordinate);
  const ward = findContainingFeature(datasets.wards, coordinate);
  const districtFeature = findContainingFeature(datasets.policeDistricts, coordinate);
  const beatFeature = findContainingFeature(datasets.policeBeats, coordinate);

  const wardId = ward ? String(ward.properties?.ward ?? "") : undefined;
  const district = normalizeDistrict(districtFeature?.properties?.dist_num);
  const beat = beatFeature ? String(beatFeature.properties?.beat ?? "") : undefined;
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
      formattedAddress: resolved.formattedAddress,
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
