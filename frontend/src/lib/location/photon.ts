import type { Coordinate } from "./types";

export type PhotonLocation = Coordinate & {
  formattedAddress: string;
  approximate: boolean;
};
type PhotonFeature = {
  geometry?: { type: string; coordinates: number[] };
  properties?: Record<string, string | number | number[]>;
};
const cache = new Map<string, { expires: number; features: PhotonFeature[] }>();

async function requestPhoton(url: URL): Promise<PhotonFeature[]> {
  const cached = cache.get(url.href);
  if (cached && cached.expires > Date.now()) return cached.features;
  const response = await fetch(url, {
    headers: { "User-Agent": "CrimeIsDown-local-development" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Local address search is temporarily unavailable. Please try again.");
  const payload = await response.json() as { features?: PhotonFeature[] };
  const features = payload.features || [];
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  cache.set(url.href, { expires: Date.now() + 300000, features });
  return features;
}

function locationFromFeature(feature: PhotonFeature): PhotonLocation | undefined {
  const [lng, lat] = feature.geometry?.coordinates || [];
  if (feature.geometry?.type !== "Point" || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
  const p = feature.properties || {};
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const address = [...new Set([p.name, street, p.city || p.district, p.state, p.postcode].filter(Boolean))].join(", ");
  if (!address) return;
  return { lat, lng, formattedAddress: address, approximate: !p.housenumber };
}

async function searchFeatures(query: string) {
  const url = new URL("https://photon.komoot.io/api/");
  url.search = new URLSearchParams({
    q: query, limit: "5", lat: "41.85", lon: "-87.63",
    bbox: "-87.95,41.64,-87.52,42.03", lang: "en",
  }).toString();
  return requestPhoton(url);
}

export async function photonSuggestions(query: string): Promise<PhotonLocation[]> {
  return (await searchFeatures(query)).flatMap(feature => {
    const location = locationFromFeature(feature);
    return location ? [location] : [];
  });
}

export async function geocodeWithPhoton(query: string | Coordinate): Promise<PhotonLocation> {
  let features: PhotonFeature[];
  if (typeof query === "string") {
    features = await searchFeatures(query);
    // Never substitute a street's midpoint for an unmatched numbered address.
    const houseNumber = /^\s*(\d+[a-z]?)\b/i.exec(query)?.[1];
    if (houseNumber) features = features.filter(feature => String(feature.properties?.housenumber || "").toLowerCase() === houseNumber.toLowerCase());
  } else {
    const url = new URL("https://photon.komoot.io/reverse");
    url.search = new URLSearchParams({lat:String(query.lat),lon:String(query.lng),limit:"1",lang:"en"}).toString();
    features = await requestPhoton(url);
  }
  const match = features.map(locationFromFeature).find(Boolean);
  if (!match) throw new Error("That address could not be found in the local geocoder. Select a suggestion or try another Chicago address.");
  return { ...match, ...(typeof query === "string" ? {} : query) };
}
