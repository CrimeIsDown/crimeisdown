declare module "leaflet-draw";
declare module "leaflet.markercluster";
declare module "leaflet-plugins/layer/vector/KML.js";
declare module "leaflet.gridlayer.googlemutant/dist/Leaflet.GoogleMutant.js";

interface Window {
  L?: typeof import("leaflet");
}
