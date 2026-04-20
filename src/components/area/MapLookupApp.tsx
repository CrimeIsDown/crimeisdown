import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Circle,
  CircleMarker,
  Control,
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

type TabKey = "map" | "traffic" | "crime";

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

type OverlaySpec = GeoJsonOverlaySpec | MarkerOverlaySpec;

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
  const mapRef = useRef<LeafletMap | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const circleRef = useRef<Circle | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
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
      if (disposed || !mapContainerRef.current) {
        return;
      }

      leafletRef.current = L;
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: chicagoZoom,
      });

      mapRef.current = map;

      const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      const dark = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
          maxZoom: 20,
        },
      );

      const layerControl = L.control.layers(
        {
          OpenStreetMap: streets,
          "Dark map": dark,
        },
        undefined,
        { collapsed: false },
      ).addTo(map) as Control.Layers;

      await Promise.all(
        overlays.map(async (overlay) => {
          const layer = await buildOverlayLayer(L, overlay);
          if (!layer) {
            return;
          }

          layerControl.addOverlay(layer, overlay.name);
          if (overlay.activeByDefault) {
            layer.addTo(map);
          }
        }),
      );
    }

    void initializeMap().catch((mapError) => {
      console.error(mapError);
    });

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
      leafletRef.current = null;
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
    if (!mapRef.current || !result || !L) {
      return;
    }

    const map = mapRef.current;
    const coordinate = L.latLng(result.meta.latitude, result.meta.longitude);

    markerRef.current?.remove();
    circleRef.current?.remove();

    markerRef.current = L.circleMarker(coordinate, {
      radius: 8,
      color: "#dc3545",
      fillColor: "#dc3545",
      fillOpacity: 0.9,
      weight: 2,
    })
      .addTo(map)
      .bindPopup(result.meta.formattedAddress);

    if (!result.meta.inChicago) {
      markerRef.current.openPopup();
    }

    if (result.query.lat !== undefined && result.query.lng !== undefined) {
      circleRef.current = L.circle(coordinate, {
        radius: 200,
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
    }
    if (result.query.lat !== undefined && result.query.lng !== undefined) {
      nextUrl.searchParams.set("lat", String(result.query.lat));
      nextUrl.searchParams.set("lng", String(result.query.lng));
    }

    window.history.replaceState({}, "", nextUrl);
  }, [result]);

  useEffect(() => {
    if (hasBootstrappedLookup.current || initialResult || initialError) {
      return;
    }

    hasBootstrappedLookup.current = true;

    const currentUrl = new URL(window.location.href);
    const initialSearch = currentUrl.searchParams.get("q")?.trim();
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

  async function runLookup(nextUrl: URL) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(nextUrl);
      const payload = (await response.json()) as
        | LocationContextResult
        | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Lookup failed.");
      }

      setResult(payload);
      setActiveTab("map");
    } catch (lookupError) {
      setResult(null);
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "Lookup failed.",
      );
    } finally {
      setLoading(false);
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
        await runLookup(requestUrl);
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
                  </div>
                ) : null}
                {result && !result.meta.inChicago ? (
                  <div className="alert alert-warning alert-dismissible fade show" role="alert">
                    This location is outside Chicago, so the boundary results given may not be correct.
                  </div>
                ) : null}
                {result ? (
                  <table className="table table-bordered table-condensed">
                    <tbody>
                      <tr className="table-info">
                        <th colSpan={2}>Location Info</th>
                      </tr>
                      <tr>
                        <td>Formatted Address</td>
                        <td>{result.meta.formattedAddress}</td>
                      </tr>
                      <tr>
                        <td>Latitude: {result.meta.latitude.toFixed(5)}</td>
                        <td>Longitude: {result.meta.longitude.toFixed(5)}</td>
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
                          <tr className="table-info">
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
                                  <h5><strong>Search the audio archive</strong></h5>
                                  {result.police.district === "2" ? (
                                    <p className="mb-0"><small><sup>*</sup>The 2nd district switched to Zone 7 on June 30, 2022.</small></p>
                                  ) : null}
                                  <p className="mt-2">
                                    <a className="btn btn-outline-primary" href={`/audio/archive?feed=${result.police.zone.slug}`}>Look up scanner recording</a>
                                  </p>
                                </>
                              ) : null}
                            </td>
                          </tr>
                        </>
                      ) : null}
                      {result.fire ? (
                        <>
                          <tr className="table-info">
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
                          <tr className="table-info">
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
        <ul className="nav nav-tabs legacy-map-tabs" id="cadTabs" role="tablist">
          <li className="nav-item">
            <button type="button" className={`nav-link${activeTab === "map" ? " active" : ""}`} onClick={() => setActiveTab("map")} aria-controls="main-map">
              <span className="d-none d-md-inline">Address Search</span> Map
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link${activeTab === "traffic" ? " active" : ""}`} onClick={() => setActiveTab("traffic")} aria-controls="traffic-map">
              Traffic<span className="d-none d-md-inline"> Map</span>
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link${activeTab === "crime" ? " active" : ""}`} onClick={() => setActiveTab("crime")} aria-controls="crime-map">
              Crime<span className="d-none d-md-inline"> Map</span>
            </button>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="/transcripts/map">Incidents<span className="d-none d-md-inline"> Map</span></a>
          </li>
        </ul>

        <div className="tab-content">
          <div className={`tab-pane fade${activeTab === "map" ? " show active" : ""}`} id="main-map" role="tabpanel" aria-labelledby="map-tab">
            <div id="leaflet-map" ref={mapContainerRef} style={{ display: activeTab === "map" ? "block" : "none" }}></div>
          </div>
          <div className={`tab-pane fade${activeTab === "traffic" ? " show active" : ""}`} id="traffic-map" role="tabpanel" aria-labelledby="traffic-tab">
            <iframe id="waze-map" title="Waze map" src={wazeUrl}></iframe>
          </div>
          <div className={`tab-pane fade${activeTab === "crime" ? " show active" : ""}`} id="crime-map" role="tabpanel" aria-labelledby="crime-tab">
            <iframe id="clear-map" title="Crime map" src={crimeMapUrl}></iframe>
          </div>
        </div>
      </div>
    </div>
  );
}

async function buildOverlayLayer(
  L: typeof import("leaflet"),
  overlay: OverlaySpec,
): Promise<GeoJSON | LayerGroup | null> {
  const response = await fetch(overlay.url);
  if (!response.ok) {
    return null;
  }

  if (overlay.type === "markers") {
    const rows = (await response.json()) as FireStation[];
    const layer = L.layerGroup();

    rows.forEach((station) => {
      const title =
        station.name ||
        [station.engine, station.truck, station.ambo, station.squad]
          .filter(Boolean)
          .join("-");
      const marker = L.circleMarker([station.latitude, station.longitude], {
        radius: 5,
        color: "#dc3545",
        fillColor: "#dc3545",
        fillOpacity: 0.75,
        weight: 1,
      });

      marker.bindPopup(buildStationPopup(title, station));
      layer.addLayer(marker);
    });

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
    onEachFeature: (feature, layer) => {
      const fields = overlay.popupFields
        .map(([key, label]) => {
          const value = feature.properties?.[key];
          if (value === undefined || value === null || value === "") {
            return null;
          }

          return `<strong>${label}:</strong> ${value}`;
        })
        .filter(Boolean);

      if (fields.length) {
        layer.bindPopup(fields.join("<br />"));
      }
    },
  }) as GeoJSON;
}

function buildStationPopup(title: string, station: FireStation) {
  return `
    <h6>${title}</h6>
    <strong>${titleCase(station.addr)}</strong>
    ${station.engine ? `<br /><strong>Engine:</strong> ${station.engine}` : ""}
    ${station.truck ? `<br /><strong>Truck/Tower:</strong> ${station.truck}` : ""}
    ${station.ambo ? `<br /><strong>Ambulance:</strong> ${station.ambo}` : ""}
    ${station.squad ? `<br /><strong>Squad:</strong> ${station.squad}` : ""}
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

  return `${station[key]} (${key === "ambo" ? "Ambo." : key === "truck" ? "Truck" : titleCase(key)})`;
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
