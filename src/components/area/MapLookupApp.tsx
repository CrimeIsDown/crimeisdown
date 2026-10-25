import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.awesome-markers/dist/leaflet.awesome-markers.css";

import { useEffect, useMemo, useRef, useState } from "react";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import type {
  Circle,
  CircleMarker,
  Control,
  DivIcon,
  FeatureGroup,
  GeoJSON,
  LatLngExpression,
  LayerGroup,
  Map as LeafletMap,
} from "leaflet";

import type {
  FireStation,
  LocationContextResult,
  TraumaCenter,
} from "@/lib/location/types";
import ScannerNotepad from "@/components/audio/ScannerNotepad";
import LiveStreamPlayer from "@/components/audio/LiveStreamPlayer";
import ArchiveDownloadForm from "@/components/audio/ArchiveDownloadForm";
import { archiveFeeds } from "@/lib/audio/data";
import RadioIdLookup from "@/components/reference/RadioIdLookup";
import UcrCodeLookup from "@/components/reference/UcrCodeLookup";
import type { RadioIdRow, UcrCodeRow } from "@/lib/reference/data";

type Props = {
  initialQuery?: string;
  initialResult?: LocationContextResult | null;
  initialError?: string | null;
  radioIds: RadioIdRow[];
  ucrCodes: UcrCodeRow[];
};

type TabKey = "map" | "traffic" | "crime" | "incidents";

type GeoJsonOverlaySpec = {
  type: "geojson";
  name: string;
  url: string;
  color: string;
  weight: number;
  activeByDefault?: boolean;
  popupFields: Array<[string, string]>;
};

type MarkerOverlaySpec = {
  type: "markers";
  name: string;
  url: string;
  activeByDefault?: boolean;
};

type KmlOverlaySpec = {
  type: "kml";
  name: string;
  url: string;
  activeByDefault?: boolean;
  attribution?: string;
};

type OverlaySpec = GeoJsonOverlaySpec | MarkerOverlaySpec | KmlOverlaySpec;

const overlays: OverlaySpec[] = [
  {
    type: "markers",
    name: "Fire Stations",
    url: "/data/city_data/fire_stations.json",
    activeByDefault: true,
  },
  {
    type: "geojson",
    name: "Police Districts",
    url: "/data/map_data/police_districts.geojson",
    color: "#0d6efd",
    weight: 3,
    activeByDefault: true,
    popupFields: [["dist_num", "Police District"]],
  },
  {
    type: "geojson",
    name: "Police Beats",
    url: "/data/map_data/police_beats.geojson",
    color: "#0b5ed7",
    weight: 2,
    popupFields: [
      ["district", "Police District"],
      ["beat_num", "Police Beat"],
    ],
  },
  {
    type: "geojson",
    name: "Neighborhoods",
    url: "/data/map_data/neighborhoods_v2.geojson",
    color: "#dc3545",
    weight: 2,
    popupFields: [["PRI_NEIGH", "Neighborhood"]],
  },
  {
    type: "geojson",
    name: "Community Areas",
    url: "/data/map_data/community_areas.geojson",
    color: "#495057",
    weight: 2,
    popupFields: [["community", "Community Area"]],
  },
  {
    type: "geojson",
    name: "Wards",
    url: "/data/map_data/wards_2023.geojson",
    color: "#198754",
    weight: 2,
    popupFields: [["ward_id", "Ward"]],
  },
  {
    type: "geojson",
    name: "Municipalities",
    url: "/data/map_data/municipalities.geojson",
    color: "#3a0",
    weight: 2,
    popupFields: [["AGENCY_DESC", "Jurisdiction"]],
  },
  {
    type: "kml",
    name: "Gangs (unofficial)",
    url: "/data/map_data/gangs.kml",
    attribution:
      'Gang map by <a href="https://np.reddit.com/r/Chiraqology/wiki/index/gangmaps" target="_blank" rel="noreferrer">u/ReggieG45</a>',
  },
] as const;

const defaultCenter: LatLngExpression = [41.85, -87.63];
const chicagoZoom = 11;
const resultZoom = 15;

export function MapLookupApp({
  initialQuery = "",
  initialResult = null,
  initialError = null,
  radioIds,
  ucrCodes,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<LocationContextResult | null>(initialResult);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("map");
  const [loadedTabs, setLoadedTabs] = useState<Set<TabKey>>(() => new Set(["map"]));
  function selectTab(tab: TabKey) {
    setActiveTab(tab);
    setLoadedTabs((tabs) => new Set([...tabs, tab]));
  }
  const [mapReady, setMapReady] = useState(false);
  const lookupRequest = useRef<AbortController | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const circleRef = useRef<Circle | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const editableLayerRef = useRef<FeatureGroup | null>(null);
  const infoControlRef = useRef<Control & { update?: (props?: Record<string, string | number>) => void } | null>(null);
  const hasBootstrappedLookup = useRef(false);

  const wazeUrl = useMemo(() => {
    if (!result) {
      return "https://embed.waze.com/iframe?zoom=11&lat=41.85&lon=-87.63&ct=livemap";
    }

    return `https://embed.waze.com/iframe?zoom=15&lat=${result.meta.latitude}&lon=${result.meta.longitude}&pin=1`;
  }, [result]);

  const crimeMapUrl = useMemo(() => {
    if (!result?.meta.inChicago) {
      return "https://chicagopd.maps.arcgis.com/apps/webappviewer/index.html?id=96ca65e89cd54b8c808b136a66778369";
    }

    return `https://chicagopd.maps.arcgis.com/apps/webappviewer/index.html?id=96ca65e89cd54b8c808b136a66778369&find=${encodeURIComponent(result.meta.formattedAddress)}`;
  }, [result]);

  useEffect(() => {
    let disposed = false;

    async function initializeMap() {
      if (!mapContainerRef.current || mapRef.current) {
        return;
      }

      const L = await import("leaflet");
      L.Icon.Default.imagePath = "";
      L.Icon.Default.mergeOptions({
        iconUrl: "/img/marker-icon.png",
        iconRetinaUrl: "/img/marker-icon-2x.png",
        shadowUrl: "/img/marker-shadow.png",
      });
      window.L = L;
      await Promise.all([
        import("leaflet-draw"),
        import("leaflet.markercluster"),
        import("leaflet-plugins/layer/vector/KML.js"),
      ]);
      if (disposed || !mapContainerRef.current) {
        return;
      }

      leafletRef.current = L;
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: chicagoZoom,
      });

      mapRef.current = map;
      setMapReady(true);

      infoControlRef.current = createInfoControl(L).addTo(map);

      const layerControl = L.control.layers(
        undefined,
        undefined,
        { collapsed: !window.matchMedia("(min-width: 768px)").matches },
      ).addTo(map) as Control.Layers;

      const mapboxToken = import.meta.env.PUBLIC_MAPBOX_ACCESS_TOKEN;
      const mapbox = mapboxToken ? L.tileLayer(
        `https://api.mapbox.com/styles/v1/erictendian/ciqn6pmjh0005bini99og1s6q/tiles/256/{z}/{x}/{y}?access_token=${encodeURIComponent(mapboxToken)}`,
        {
          attribution:
            '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          minZoom: 0,
          maxZoom: 20,
        },
      ) : null;
      const mapboxDark = mapboxToken ? L.tileLayer(
        `https://api.mapbox.com/styles/v1/erictendian/cj9ne99zz3e112rp4pxcpua1z/tiles/256/{z}/{x}/{y}?access_token=${encodeURIComponent(mapboxToken)}`,
        {
          attribution:
            '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          minZoom: 0,
          maxZoom: 20,
        },
      ) : null;
      const openStreetMap = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
        maxNativeZoom: 19,
        minZoom: 0,
        maxZoom: 20,
      });
      const googleHybrid = L.tileLayer("https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
        attribution: "&copy; Google",
        maxZoom: 20,
        subdomains: ["0", "1", "2", "3"],
      });

      if (mapbox) layerControl.addBaseLayer(mapbox, "MapBox Streets");
      if (mapboxDark) layerControl.addBaseLayer(mapboxDark, "MapBox Streets Dark");
      layerControl.addBaseLayer(openStreetMap, "OpenStreetMap");
      layerControl.addBaseLayer(googleHybrid, "Google Hybrid");

      const preferredBaseLayer = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? mapboxDark
        : mapbox;
      (preferredBaseLayer ?? openStreetMap).addTo(map);

      addStreetViewControl(L, map);
      addAddressControl(L, map, (value) => {
        setQuery(value);
        const url = new URL("/api/location-context", window.location.origin);
        url.searchParams.set("q", value);
        void runLookup(url);
      });

      editableLayerRef.current = L.featureGroup().addTo(map);
      layerControl.addOverlay(editableLayerRef.current, "User Features");
      const leafletWithDraw = L as unknown as typeof L & {
        Control: typeof L.Control & {
          Draw: new (options: Record<string, unknown>) => Control;
        };
        Draw: {
          Event: {
            CREATED: string;
          };
        };
      };
      const drawControl = new leafletWithDraw.Control.Draw({
        edit: {
          featureGroup: editableLayerRef.current,
          poly: {
            allowIntersection: false,
          },
        },
        draw: {
          polyline: {
            shapeOptions: {
              color: "#00ff00",
              weight: 10,
            },
          },
          polygon: {
            showArea: true,
            allowIntersection: false,
            drawError: {
              color: "#da2600",
              message: "<strong>Error:<strong> Polygon cannot intersect with itself",
            },
            shapeOptions: {
              color: "#00ff00",
            },
          },
        },
      });
      map.addControl(drawControl);
      map.on(leafletWithDraw.Draw.Event.CREATED, (event: { layer: LayerGroup }) => {
        editableLayerRef.current?.addLayer(event.layer);
      });

      const boundaries: { layer: GeoJSON; spec: GeoJsonOverlaySpec }[] = [];
      const showBoundaryInfo = (event: { latlng: { lat: number; lng: number }; type: string; originalEvent?: MouseEvent }) => {
        if (event.originalEvent?.buttons || drawing) return;
        const props: Record<string, string | number> = {};
        const candidate = point([event.latlng.lng, event.latlng.lat]);
        for (const { layer, spec } of boundaries) {
          let matched = false;
          layer.eachLayer((entry) => {
            if (matched) return;
            const feature = (entry as unknown as { feature?: Feature<Polygon | MultiPolygon> }).feature;
            if (feature && booleanPointInPolygon(candidate, feature)) {
              matched = true;
              for (const [key, label] of spec.popupFields) {
                const value = feature.properties?.[key];
                if (value !== undefined && value !== null) props[label] = value;
              }
            }
          });
        }
        infoControlRef.current?.update?.(props);
        if (event.type === "click" && Object.keys(props).length) {
          const contents = document.createElement("div");
          contents.innerHTML = infoControlRef.current?.getContainer()?.innerHTML || "";
          L.popup().setLatLng(event.latlng).setContent(contents).openOn(map);
        }
      };
      let drawing = false;
      map.on("draw:drawstart draw:editstart draw:deletestart", () => { drawing = true; });
      map.on("draw:drawstop draw:editstop draw:deletestop", () => { drawing = false; });
      map.on("mousemove", showBoundaryInfo);
      map.on("click", showBoundaryInfo);
      for (const overlay of overlays) {
        const layer = await buildOverlayLayer(
          L,
          map,
          overlay,
        );
        if (!layer) {
          continue;
        }

        layerControl.addOverlay(layer, overlay.name);
        if (overlay.type === "geojson") boundaries.push({ layer: layer as GeoJSON, spec: overlay });
        if (overlay.activeByDefault) {
          layer.addTo(map);
        }
      }
    }

    void initializeMap().catch((mapError) => {
      console.error(mapError);
    });

    return () => {
      disposed = true;
      lookupRequest.current?.abort();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
      editableLayerRef.current = null;
      leafletRef.current = null;
      infoControlRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "map") {
      return;
    }

    const timer = window.setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 50);

    return () => window.clearTimeout(timer);
  }, [activeTab]);

  useEffect(() => {
    const L = leafletRef.current;
    if (!mapRef.current || !L) {
      return;
    }

    const map = mapRef.current;
    markerRef.current?.remove();
    circleRef.current?.remove();
    if (!result) return;
    const coordinate = L.latLng(result.meta.latitude, result.meta.longitude);

    markerRef.current = L.circleMarker(coordinate, {
      radius: 8,
      color: "#dc3545",
      fillColor: "#dc3545",
      fillOpacity: 0.9,
      weight: 2,
    })
      .addTo(map)
      .bindPopup(result.meta.accuracy !== undefined ? `You are within ${(result.meta.accuracy * 3.28084).toPrecision(5)} feet of this point` : result.meta.formattedAddress);

    if (!result.meta.inChicago || result.meta.accuracy !== undefined) {
      markerRef.current.openPopup();
    }

    if (result.meta.accuracy !== undefined) {
      circleRef.current = L.circle(coordinate, {
        radius: result.meta.accuracy,
        color: "#0d6efd",
        fillOpacity: 0.08,
      }).addTo(map);
    }

    map.setView(coordinate, resultZoom);

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("q");
    nextUrl.searchParams.delete("lat");
    nextUrl.searchParams.delete("lng");

    if (result.query.q) {
      nextUrl.searchParams.set("q", result.query.q);
      nextUrl.hash = "location_query=" + encodeURIComponent(result.query.q);
    } else {
      nextUrl.hash = "";
    }
    if (result.query.lat !== undefined && result.query.lng !== undefined) {
      nextUrl.searchParams.set("lat", String(result.query.lat));
      nextUrl.searchParams.set("lng", String(result.query.lng));
    }

    window.history.replaceState({}, "", nextUrl);
  }, [result, mapReady]);

  useEffect(() => {
    if (hasBootstrappedLookup.current || initialResult || initialError) {
      return;
    }

    hasBootstrappedLookup.current = true;

    const currentUrl = new URL(window.location.href);
    const initialSearch = (currentUrl.searchParams.get("q") || new URLSearchParams(currentUrl.hash.slice(1)).get("location_query"))?.trim();
    const latParam = currentUrl.searchParams.get("lat");
    const lngParam = currentUrl.searchParams.get("lng");
    const lat = latParam === null ? Number.NaN : Number(latParam);
    const lng = lngParam === null ? Number.NaN : Number(lngParam);

    if (initialSearch) {
      setQuery(initialSearch);

      const requestUrl = new URL("/api/location-context", window.location.origin);
      requestUrl.searchParams.set("q", initialSearch);
      void runLookup(requestUrl);
      return;
    }

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const requestUrl = new URL("/api/location-context", window.location.origin);
      requestUrl.searchParams.set("lat", String(lat));
      requestUrl.searchParams.set("lng", String(lng));
      void runLookup(requestUrl);
    }
  }, [initialError, initialResult]);

  async function runLookup(nextUrl: URL, accuracy?: number) {
    lookupRequest.current?.abort();
    const controller = new AbortController();
    lookupRequest.current = controller;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(nextUrl, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const payload = (await response.json()) as
        | LocationContextResult
        | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Lookup failed.");
      }

      if (accuracy !== undefined) {
        payload.meta.formattedAddress = "N/A - From device location";
        payload.meta.accuracy = accuracy;
      }
      if (payload.query.q) setQuery(payload.query.q);
      setResult(payload);
      setActiveTab("map");
    } catch (lookupError) {
      if (controller.signal.aborted) return;
      setResult(null);
      setError(
        lookupError instanceof Error
          ? lookupError.name === "TimeoutError" ? "Location search timed out. Please try again." : lookupError.message
          : "Lookup failed.",
      );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  async function onSubmit(event: { preventDefault(): void }) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setError("Enter an address or place to search.");
      return;
    }

    const requestUrl = new URL("/api/location-context", window.location.origin);
    requestUrl.searchParams.set("q", trimmed);
    await runLookup(requestUrl);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("This browser does not support geolocation.");
      return;
    }

    setLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const requestUrl = new URL("/api/location-context", window.location.origin);
        requestUrl.searchParams.set("lat", String(position.coords.latitude));
        requestUrl.searchParams.set("lng", String(position.coords.longitude));
        setQuery("");
        await runLookup(requestUrl, position.coords.accuracy);
        setLocating(false);
      },
      (geoError) => {
        setLocating(false);
        setError(geoError.message || "Unable to determine your location.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  }

  return (
    <div className="row">
      <div className="col-md-4 col-lg-3 search-container mb-4 mb-md-0">
        <p><em>Interact with this map or use the search box to find information about a specific address. Police districts are outlined in blue.</em></p>
        <div className="accordion" id="accordion">
          <div className="accordion-item">
            <h2 className="accordion-header" id="headingAddrSearch">
              <button className="accordion-button" data-bs-toggle="collapse" data-bs-target="#collapseAddrSearch" aria-expanded="true" aria-controls="collapseAddrSearch" type="button">
                Address Search
              </button>
            </h2>
            <div id="collapseAddrSearch" className="accordion-collapse collapse show" aria-labelledby="headingAddrSearch">
              <div id="address-search" className="accordion-body">
                <form onSubmit={onSubmit}>
                  <div className="form-group">
                    <label htmlFor="address">Address, intersection, place to search</label>
                    <div className="input-group">
                      <input
                        className="form-control"
                        id="address"
                        name="address"
                        placeholder="e.g. 3510 S Michigan, Chicago"
                        type="text"
                        value={query}
                        aria-label="Address, intersection, place to search"
                        onChange={(event) => setQuery(event.target.value)}
                      />
                      <button className="btn btn-primary" type="submit" disabled={loading}>
                        {loading ? "Searching..." : "Search"}
                      </button>
                    </div>
                  </div>
                </form>
                <div className="form-group mt-1 mb-3">
                  <button type="button" className={`btn btn-info${locating ? " disabled" : ""}`} onClick={useMyLocation} title="Device geolocation works best on mobile">
                    {locating ? "Locating..." : "Use my location"}
                  </button>
                </div>
                {error ? (
                  <div className="alert alert-danger alert-dismissible fade show" role="alert">
                    {error}
                    <button type="button" className="btn-close" aria-label="Close" onClick={() => setError(null)} />
                  </div>
                ) : null}
                {result?.meta.approximate ? <div className="alert alert-warning" role="alert">The location entered is not precise, the boundary results given may not be correct. Use a valid street address for better accuracy.</div> : null}
                {result?.meta.accuracy !== undefined && result.meta.accuracy > 1000 ? <div className="alert alert-warning" role="alert">Warning: We were not able to determine a precise location, so your location results may be incorrect. Try a different device for better results.</div> : null}
                {result && !result.meta.inChicago ? (
                  <div className="alert alert-warning alert-dismissible fade show" role="alert">
                    This location is outside Chicago, so the boundary results given may not be correct.
                  </div>
                ) : null}
                {result ? (
                  <table className="table table-bordered table-condensed">
                    <tbody>
                      <tr className="info">
                        <th colSpan={2}>Location Info</th>
                      </tr>
                      <tr>
                        <td>Formatted Address</td>
                        <td>{result.meta.formattedAddress}</td>
                      </tr>
                      <tr>
                        <td>Latitude: {result.meta.latitude.toFixed(6)}</td>
                        <td>Longitude: {result.meta.longitude.toFixed(6)}</td>
                      </tr>
                      <tr>
                        <td>Neighborhood</td>
                        <td>{result.meta.neighborhood || ""}</td>
                      </tr>
                      <tr>
                        <td>Community Area</td>
                        <td>{result.meta.communityArea || ""}</td>
                      </tr>
                      <tr>
                        <td>Ward / Alderman</td>
                        <td>
                          {result.meta.ward ? (
                            <>
                              {result.meta.ward}
                              {result.meta.alderman ? (
                                <>
                                  {" - "}
                                  <a href={result.meta.alderman.website} target="_blank" rel="noreferrer">
                                    Alderman {result.meta.alderman.name}
                                  </a>
                                </>
                              ) : null}
                            </>
                          ) : null}
                        </td>
                      </tr>
                      {result.police ? (
                        <>
                          <tr className="info">
                            <th colSpan={2}>Chicago Police Department</th>
                          </tr>
                          <tr>
                            <td>District {result.police.district || ""}, Beat {result.police.beat || ""}</td>
                            <td>Area {result.police.area || ""}</td>
                          </tr>
                          <tr>
                            <td colSpan={2}>
                              {result.police.zone ? (
                                <>
                                  <strong>{result.police.zone.name}</strong>{result.police.zone.frequency ? ` (${result.police.zone.frequency})` : ""}<br />
                                  <p>{result.police.zone.description}</p>
                                  <p>
                                    <a className="btn btn-primary" href={`/audio/live/${result.police.zone.slug}`} title={`Listen to ${result.police.zone.name}`}>
                                      Listen to CPD with Instant Replay
                                    </a>
                                  </p>
                                  <LiveStreamPlayer key={`stream-${result.police.zone.slug}`} slug={result.police.zone.slug} broadcastify={result.police.zone.broadcastify} />
                                  <h5><strong>Search the audio archive</strong></h5>
                                  {result.police.district === "2" ? (
                                    <p className="mb-0"><small><sup>*</sup>The 2nd district switched to Zone 7 on June 30, 2022.</small></p>
                                  ) : null}
                                  <ArchiveDownloadForm key={`archive-${result.police.zone.slug}`} feeds={archiveFeeds} initialFeed={result.police.zone.slug} />
                                </>
                              ) : null}
                            </td>
                          </tr>
                        </>
                      ) : null}
                      {result.fire ? (
                        <>
                          <tr className="info">
                            <th colSpan={2}>Chicago Fire Department</th>
                          </tr>
                          <tr>
                            <td>
                              <i>Nearest Companies:</i><br />
                              {formatStation(result.fire.nearestEngine, "engine")}<br />
                              {formatStation(result.fire.nearestTruck, "truck")}<br />
                              {formatStation(result.fire.nearestAmbo, "ambo")}<br />
                              {formatStation(result.fire.nearestSquad, "squad")}
                            </td>
                            <td>
                              <i>Loc. Within:</i><br />
                              Battalion {result.fire.battalion || ""}<br />
                              Fire Dist. {result.fire.fireDistrict || ""}<br />
                              EMS District {result.fire.emsDistrict || ""}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={2}>
                              Radio Channel: <strong>{result.fire.channel || ""}</strong>
                              {result.fire.channel ? (
                                <a
                                  href={result.fire.channel === "Main" ? "https://openmhz.com/system/chi_cfd?filter-type=talkgroup&filter-code=1,3" : "https://openmhz.com/system/chi_cfd?filter-type=talkgroup&filter-code=2,4"}
                                  className="btn btn-primary ms-2"
                                  title={`Listen to CFD ${result.fire.channel}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Listen to CFD with Instant Replay
                                </a>
                              ) : null}
                            </td>
                          </tr>
                        </>
                      ) : null}
                      {result.ems ? (
                        <>
                          <tr className="info">
                            <th colSpan={2}>Closest Medical Services</th>
                          </tr>
                          <tr>
                            <td colSpan={2}>Adult Trauma Center: {formatTrauma(result.ems.nearestTraumaAdult)}</td>
                          </tr>
                          <tr>
                            <td colSpan={2}>Pediatric Trauma Center: {formatTrauma(result.ems.nearestTraumaPed)}</td>
                          </tr>
                        </>
                      ) : null}
                    </tbody>
                  </table>
                ) : null}
              </div>
            </div>
          </div>
          <div className="accordion-item">
            <h2 className="accordion-header" id="headingRIDSearch">
              <button className="accordion-button collapsed" data-bs-toggle="collapse" data-bs-target="#collapseRIDSearch" aria-expanded="false" aria-controls="collapseRIDSearch" type="button">
                Radio ID Search
              </button>
            </h2>
            <div id="collapseRIDSearch" className="accordion-collapse collapse" aria-labelledby="headingRIDSearch">
              <div id="search-radioids" className="accordion-body">
                <RadioIdLookup rows={radioIds} />
              </div>
            </div>
          </div>
          <div className="accordion-item">
            <h2 className="accordion-header" id="headingUCRSearch">
              <button className="accordion-button collapsed" data-bs-toggle="collapse" data-bs-target="#collapseUCRSearch" aria-expanded="false" aria-controls="collapseUCRSearch" type="button">
                UCR Code Search
              </button>
            </h2>
            <div id="collapseUCRSearch" className="accordion-collapse collapse" aria-labelledby="headingUCRSearch">
              <div id="search-ucrcodes" className="accordion-body">
                <UcrCodeLookup rows={ucrCodes} />
              </div>
            </div>
          </div>
          <div className="accordion-item">
            <h2 className="accordion-header" id="headingNotepad">
              <button className="accordion-button collapsed" data-bs-toggle="collapse" data-bs-target="#collapseNotepad" aria-expanded="false" aria-controls="collapseNotepad" type="button">
                Notepad
              </button>
            </h2>
            <div id="collapseNotepad" className="accordion-collapse collapse" aria-labelledby="headingNotepad">
              <div id="notepad" className="accordion-body">
                <ScannerNotepad />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="col map-container">
        <ul className="nav nav-tabs legacy-map-tabs" id="cadTabs" role="tablist" onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
          const current = tabs.indexOf(event.target as HTMLButtonElement);
          if (current < 0) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
          tabs[next].focus();
          tabs[next].click();
        }}>
          <li className="nav-item">
            <button type="button" role="tab" id="map-tab" aria-selected={activeTab === "map"} tabIndex={activeTab === "map" ? 0 : -1} className={`nav-link${activeTab === "map" ? " active" : ""}`} onClick={() => selectTab("map")} aria-controls="main-map">
              <span className="d-none d-md-inline">Address Search</span> Map
            </button>
          </li>
          <li className="nav-item">
            <button type="button" role="tab" id="traffic-tab" aria-selected={activeTab === "traffic"} tabIndex={activeTab === "traffic" ? 0 : -1} className={`nav-link${activeTab === "traffic" ? " active" : ""}`} onClick={() => selectTab("traffic")} aria-controls="traffic-map">
              Traffic<span className="d-none d-md-inline"> Map</span>
            </button>
          </li>
          <li className="nav-item">
            <button type="button" role="tab" id="crime-tab" aria-selected={activeTab === "crime"} tabIndex={activeTab === "crime" ? 0 : -1} className={`nav-link${activeTab === "crime" ? " active" : ""}`} onClick={() => selectTab("crime")} aria-controls="crime-map">
              Crime<span className="d-none d-md-inline"> Map</span>
            </button>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="/transcripts/map">
              Incidents<span className="d-none d-md-inline"> Map</span>
            </a>
          </li>
        </ul>

        <div className="tab-content">
          <div className={`tab-pane fade${activeTab === "map" ? " show active" : ""}`} id="main-map" role="tabpanel" aria-labelledby="map-tab">
            <div id="leaflet-map" ref={mapContainerRef} style={{ display: activeTab === "map" ? "block" : "none" }}></div>
          </div>
          <div className={`tab-pane fade${activeTab === "traffic" ? " show active" : ""}`} id="traffic-map" role="tabpanel" aria-labelledby="traffic-tab">
            <iframe id="waze-map" title="Waze map" src={loadedTabs.has("traffic") ? wazeUrl : undefined}></iframe>
          </div>
          <div className={`tab-pane fade${activeTab === "crime" ? " show active" : ""}`} id="crime-map" role="tabpanel" aria-labelledby="crime-tab">
            <iframe id="clear-map" title="Crime map" src={loadedTabs.has("crime") ? crimeMapUrl : undefined}></iframe>
          </div>
        </div>
      </div>
    </div>
  );
}

async function buildOverlayLayer(
  L: typeof import("leaflet"),
  map: LeafletMap,
  overlay: OverlaySpec,
): Promise<GeoJSON | LayerGroup | null> {
  const response = await fetch(overlay.url);
  if (!response.ok) {
    return null;
  }

  if (overlay.type === "markers") {
    const rows = (await response.json()) as FireStation[];
    const markerClusterGroup = (L as typeof L & {
      markerClusterGroup?: (options?: Record<string, unknown>) => LayerGroup;
    }).markerClusterGroup;
    const layer = markerClusterGroup
      ? markerClusterGroup({ showCoverageOnHover: false })
      : L.layerGroup();
    const fireIcon = makeFireIcon(L);

    rows.forEach((station) => {
      const title =
        station.name ||
        [station.engine, station.truck, station.ambo, station.squad]
          .filter(Boolean)
          .join("-");
      const marker = L.marker([station.latitude, station.longitude], {
        title,
        icon: fireIcon,
      });

      marker.bindPopup(buildStationPopup(title, station));
      layer.addLayer(marker);
    });

    return layer;
  }

  if (overlay.type === "kml") {
    const kmlCtor = (L as typeof L & {
      KML?: (new () => LayerGroup) & { parseKML(document: Document): LayerGroup[] };
    }).KML;

    if (!kmlCtor) {
      return null;
    }

    if (overlay.attribution) {
      map.attributionControl.addAttribution(overlay.attribution);
    }

    const kmlText = await response.text();
    const kml = new DOMParser().parseFromString(kmlText, "text/xml");
    const layer = new kmlCtor();
    // This plugin's addKML expects a URL, unlike the Ember plugin. Parse the
    // already fetched XML directly instead of requesting "[object XMLDocument]".
    for (const child of kmlCtor.parseKML(kml)) layer.addLayer(child);
    return layer;
  }

  const data = await response.json();
  return L.geoJSON(data, {
    style: {
      color: overlay.color,
      weight: overlay.weight,
      opacity: 0.85,
      fillOpacity: 0.03,
    },

  }) as GeoJSON;
}

function createInfoControl(L: typeof import("leaflet")) {
  const info = new L.Control({ position: "topright" }) as Control & {
    _div?: HTMLDivElement;
    update?: (props?: Record<string, string | number>) => void;
  };

  info.onAdd = function () {
    this._div = L.DomUtil.create("div", "info");
    this.update?.();
    return this._div;
  };

  info.update = function (props) {
    const rows = props && Object.keys(props).length
      ? Object.entries(props)
          .map(([key, value]) => `<p><em>${key}</em>: ${value}</p>`)
          .join("")
      : "<p>Hover/tap a layer</p>";

    if (this._div) {
      this._div.innerHTML = `<h4>Layer Info</h4>${rows}`;
    }
  };

  return info;
}

function addStreetViewControl(
  L: typeof import("leaflet"),
  map: LeafletMap,
) {
  const control = new L.Control({ position: "topleft" });

  control.onAdd = function () {
    const container = L.DomUtil.create("div", "leaflet-bar leaflet-control legacy-map-link-control");
    const streetViewLink = L.DomUtil.create("a", "", container);
    streetViewLink.href = googleStreetViewUrl(map);
    map.on("moveend", () => { streetViewLink.href = googleStreetViewUrl(map); });
    streetViewLink.target = "_blank";
    streetViewLink.rel = "noopener noreferrer";
    streetViewLink.textContent = "Street View";
    streetViewLink.title = "Open Google Street View near the map center";

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.on(streetViewLink, "click", () => {
      streetViewLink.href = googleStreetViewUrl(map);
    });

    return container;
  };

  control.addTo(map);
}

function googleStreetViewUrl(map: LeafletMap) {
  const center = map.getCenter();
  return `https://www.google.com/maps?layer=c&cbll=${center.lat},${center.lng}`;
}

function addAddressControl(L: typeof import("leaflet"), map: LeafletMap, search: (query: string) => void) {
  const control = new L.Control({ position: "topleft" });
  control.onAdd = () => {
    const container = L.DomUtil.create("div", "leaflet-bar leaflet-control legacy-geosearch-control");
    const toggle = L.DomUtil.create("a", "", container);
    toggle.href = "#";
    toggle.title = "Enter address";
    toggle.setAttribute("aria-label", "Enter address");
    toggle.textContent = "⌕";
    const form = L.DomUtil.create("form", "input-group", container);
    form.hidden = true;
    const input = L.DomUtil.create("input", "form-control", form);
    input.type = "search";
    input.placeholder = "Enter address";
    input.setAttribute("aria-label", "Search map address");
    const submit = L.DomUtil.create("button", "btn btn-primary", form);
    submit.type = "submit";
    submit.textContent = "Search";
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      form.hidden = !form.hidden;
      toggle.setAttribute("aria-expanded", String(!form.hidden));
      if (!form.hidden) input.focus();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (input.value.trim()) search(input.value.trim());
    });
    return container;
  };
  control.addTo(map);
}

function makeFireIcon(L: typeof import("leaflet")): DivIcon {
  return L.divIcon({
    iconSize: [35, 45],
    iconAnchor: [17, 42],
    popupAnchor: [1, -32],
    shadowAnchor: [10, 12],
    shadowSize: [36, 16],
    className: "awesome-marker-icon-red awesome-marker",
    html: '<svg class="svg-inline--fa fa-fire-extinguisher" data-prefix="fas" data-icon="fire-extinguisher" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="color: #fff;font-size: 1rem;margin-top: 10px;"><path fill="currentColor" d="M500.3 7.3C507.7 13.3 512 22.4 512 32v96c0 9.6-4.3 18.7-11.7 24.7s-17.2 8.5-26.6 6.6l-160-32C301.5 124.9 292 115.7 289 104H224v34.8c37.8 18 64 56.5 64 101.2V384H64V240c0-44.7 26.2-83.2 64-101.2V110c-36.2 11.1-66 36.9-82.3 70.5c-5.8 11.9-20.2 16.9-32.1 11.1S-3.3 171.4 2.5 159.5C26.7 109.8 72.7 72.6 128 60.4V32c0-17.7 14.3-32 32-32h32c17.7 0 32 14.3 32 32V56h65c3-11.7 12.5-20.9 24.7-23.4l160-32c9.4-1.9 19.1 .6 26.6 6.6zM288 416v32c0 35.3-28.7 64-64 64H128c-35.3 0-64-28.7-64-64V416H288zM176 96c8.8 0 16-7.2 16-16s-7.2-16-16-16s-16 7.2-16 16s7.2 16 16 16z"></path></svg>',
  });
}

function buildStationPopup(title: string, station: FireStation) {
  return `
    <h6>${title}</h6>
    <strong>${titleCase(station.addr)}</strong>
    ${station.engine ? `<br /><strong>Engine:</strong> ${station.engine}` : ""}
    ${station.truck ? `<br /><strong>Truck/Tower:</strong> ${station.truck}` : ""}
    ${station.ambo ? `<br /><strong>Ambulance:</strong> ${station.ambo}` : ""}
    ${station.squad ? `<br /><strong>Squad:</strong> ${station.squad}` : ""}
    ${station.special ? `<br /><strong>Special (search radio IDs):</strong> ${station.special}` : ""}
    ${station.batt ? `<br /><strong>Battalion:</strong> ${station.batt}` : ""}
    ${station.fireDist ? `<br /><strong>District:</strong> ${station.fireDist}` : ""}
    ${station.emsDist ? `<br /><strong>EMS District:</strong> ${station.emsDist}` : ""}
    ${station.radio ? `<br /><strong>Radio Channel:</strong> ${station.radio}` : ""}
  `;
}

function formatStation(
  station: FireStation | undefined,
  key: "engine" | "truck" | "ambo" | "squad",
) {
  if (!station?.[key]) {
    return "N/A";
  }

  return <span tabIndex={0} title={titleCase(station.addr)}>{station[key]} ({key === "ambo" ? "Ambo." : key === "truck" ? "Truck" : titleCase(key)})</span>;
}

function formatTrauma(center: TraumaCenter | undefined) {
  if (!center?.name) {
    return "N/A";
  }

  return `${center.name} - ${center.distanceMi ?? "N/A"}mi (${center.addr}, ${center.city}, ${center.state}, ${center.zip}) - Patient Reports on ${center.medChannel}`;
}

function titleCase(value: string) {
  return value.replace(/(?:^|\s|-|\/)\S/g, (match) => match.toUpperCase());
}
