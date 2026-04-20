import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import aldermen from "../../../public/data/city_data/aldermen.json";
import fireStations from "../../../public/data/city_data/fire_stations.json";
import traumaCenters from "../../../public/data/city_data/trauma_centers.json";
import streams from "../../../public/data/audio_data/online_streams.json";

import type { FireStation, StreamInfo, TraumaCenter } from "@/lib/location/types";
import { mapOverlayCollections } from "@/lib/location/overlays";

type LookupDatasets = {
  communityAreas: FeatureCollection<Polygon | MultiPolygon>;
  neighborhoods: FeatureCollection<Polygon | MultiPolygon>;
  policeDistricts: FeatureCollection<Polygon | MultiPolygon>;
  policeBeats: FeatureCollection<Polygon | MultiPolygon>;
  wards: FeatureCollection<Polygon | MultiPolygon>;
  fireStations: FireStation[];
  traumaCenters: TraumaCenter[];
  aldermen: { ward: string; name: string; website?: string }[];
  streams: StreamInfo[];
};

export function loadLookupDatasets() {
  return {
    communityAreas: mapOverlayCollections.communityAreas,
    neighborhoods: mapOverlayCollections.neighborhoods,
    policeDistricts: mapOverlayCollections.policeDistricts,
    policeBeats: mapOverlayCollections.policeBeats,
    wards: mapOverlayCollections.wards,
    fireStations: fireStations as FireStation[],
    traumaCenters: traumaCenters as TraumaCenter[],
    aldermen: aldermen.map((entry) => ({
      ...entry,
      ward: String(entry.ward),
    })),
    streams: streams as StreamInfo[],
  } satisfies LookupDatasets;
}
