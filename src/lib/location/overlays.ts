import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { AssetTextFetcher } from "@/lib/location/types";

function parseFeatureCollection(raw: string) {
  return JSON.parse(raw) as FeatureCollection<Polygon | MultiPolygon>;
}

type MapOverlayCollections = {
  communityAreas: FeatureCollection<Polygon | MultiPolygon>;
  neighborhoods: FeatureCollection<Polygon | MultiPolygon>;
  policeDistricts: FeatureCollection<Polygon | MultiPolygon>;
  policeBeats: FeatureCollection<Polygon | MultiPolygon>;
  wards: FeatureCollection<Polygon | MultiPolygon>;
};

let mapOverlayCollectionsPromise: Promise<MapOverlayCollections> | undefined;

export function loadMapOverlayCollections(assetText: AssetTextFetcher) {
  if (!mapOverlayCollectionsPromise) {
    mapOverlayCollectionsPromise = (async () => {
      const [
        communityAreasRaw,
        neighborhoodsRaw,
        policeDistrictsRaw,
        policeBeatsRaw,
        wardsRaw,
      ] = await Promise.all([
        assetText("/data/map_data/community_areas.geojson"),
        assetText("/data/map_data/neighborhoods_v2.geojson"),
        assetText("/data/map_data/police_districts.geojson"),
        assetText("/data/map_data/police_beats.geojson"),
        assetText("/data/map_data/wards_2023.geojson"),
      ]);

      return {
        communityAreas: parseFeatureCollection(communityAreasRaw),
        neighborhoods: parseFeatureCollection(neighborhoodsRaw),
        policeDistricts: parseFeatureCollection(policeDistrictsRaw),
        policeBeats: parseFeatureCollection(policeBeatsRaw),
        wards: parseFeatureCollection(wardsRaw),
      };
    })().catch((error) => {
      mapOverlayCollectionsPromise = undefined;
      throw error;
    });
  }

  return mapOverlayCollectionsPromise;
}
