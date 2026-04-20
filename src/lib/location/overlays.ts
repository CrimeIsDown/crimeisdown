import communityAreasRaw from "@/data/map_data/community_areas.geojson?raw";
import neighborhoodsRaw from "@/data/map_data/neighborhoods_v2.geojson?raw";
import policeDistrictsRaw from "@/data/map_data/police_districts.geojson?raw";
import policeBeatsRaw from "@/data/map_data/police_beats.geojson?raw";
import wardsRaw from "@/data/map_data/wards_2023.geojson?raw";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

function parseFeatureCollection(raw: string) {
  return JSON.parse(raw) as FeatureCollection<Polygon | MultiPolygon>;
}

export const mapOverlayCollections = {
  communityAreas: parseFeatureCollection(communityAreasRaw),
  neighborhoods: parseFeatureCollection(neighborhoodsRaw),
  policeDistricts: parseFeatureCollection(policeDistrictsRaw),
  policeBeats: parseFeatureCollection(policeBeatsRaw),
  wards: parseFeatureCollection(wardsRaw),
};
