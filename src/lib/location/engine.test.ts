import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupLocationContext } from "./engine";

const assets = (path: string) => readFile(new URL(`../../../public${path}`, import.meta.url), "utf8");
const headquarters = {
  formatted_address: "3510 S Michigan Ave, Chicago, IL 60653, USA",
  geometry: { location: { lat: 41.8302264, lng: -87.6238081 }, location_type: "ROOFTOP" },
};
const request = { origin: "https://frontend.example.test", assetText: assets, googleGeocodingKey: "test-geocoding-key" };
afterEach(() => vi.unstubAllGlobals());

describe("Ember map lookup compatibility", () => {
  it("resolves headquarters to district 2 and beat 0213, not a similarly named downtown landmark", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL) => Response.json({ status: "OK", results: [headquarters] }));
    vi.stubGlobal("fetch", fetcher);
    const result = await lookupLocationContext({ ...request, q: "3510 S Michigan, Chicago" });
    expect(new URL(String(fetcher.mock.calls[0][0])).hostname).toBe("maps.googleapis.com");
    expect(result.meta).toMatchObject({ formattedAddress: headquarters.formatted_address, communityArea: "Douglas", neighborhood: "Bronzeville", ward: "3", approximate: false });
    expect(result.police).toMatchObject({ district: "2", beat: "0213", area: "Central", zone: { slug: "zone7" } });
    expect(result.fire?.nearestEngine?.engine).toBe("E19");
    expect(result.ems?.nearestTraumaAdult?.name).toBe("University of Chicago Medical Center");
  });

  it("turns apparatus aliases into the same station address used by Ember", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL) => Response.json({ status: "OK", results: [headquarters] }));
    vi.stubGlobal("fetch", fetcher);
    const result = await lookupLocationContext({ ...request, q: "e19" });
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get("address")).toBe("3421 S CALUMET AVE 60616");
    expect(result.query.q).toBe("3421 S CALUMET AVE 60616");
  });

  it("reports approximate outside-city matches without inventing Chicago services", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: "OK", results: [{ formatted_address: "Evanston, IL, USA", geometry: { location: { lat: 42.0451, lng: -87.6877 }, location_type: "APPROXIMATE" } }] })));
    const result = await lookupLocationContext({ ...request, q: "Evanston, IL" });
    expect(result.meta).toMatchObject({ inChicago: false, approximate: true });
    expect(result.police).toBeUndefined();
    expect(result.fire).toBeUndefined();
  });

  it("does not move device coordinates to a reverse-geocoded building", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL) => Response.json({ status: "OK", results: [headquarters] })));
    const result = await lookupLocationContext({ ...request, lat: 41.8781, lng: -87.6298 });
    expect(result.meta).toMatchObject({ latitude: 41.8781, longitude: -87.6298 });
    expect(result.police?.beat).toBe("0113");
  });

  it("rejects a nonexistent address instead of silently choosing a different landmark", async () => {
    const fetcher = vi.fn(async () => Response.json({ status: "ZERO_RESULTS", results: [] }));
    vi.stubGlobal("fetch", fetcher);
    await expect(lookupLocationContext({ ...request, q: "a location that does not exist" })).rejects.toThrow("could not be found");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not send a geocoding request when the server key is missing", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(lookupLocationContext({ ...request, googleGeocodingKey: undefined, q: "Chicago" })).rejects.toThrow("temporarily unavailable");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects invalid coordinates before calling a geocoder", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(lookupLocationContext({ ...request, lat: 100, lng: -87 })).rejects.toThrow("valid coordinates");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
