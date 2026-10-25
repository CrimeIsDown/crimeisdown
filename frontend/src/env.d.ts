/// <reference types="astro/client" />

declare module "*.geojson" {
  const value: GeoJSON.FeatureCollection;
  export default value;
}
