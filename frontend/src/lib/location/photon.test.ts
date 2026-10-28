import { afterEach, describe, expect, it, vi } from "vitest";
import { geocodeWithPhoton, photonSuggestions } from "./photon";

const house = {
  geometry: {type:"Point",coordinates:[-87.62412,41.83055]},
  properties: {name:"Police Headquarters",housenumber:"3510",street:"South Michigan Avenue",city:"Chicago",state:"Illinois",postcode:"60653"},
};
afterEach(() => vi.unstubAllGlobals());

describe("local Photon geocoding", () => {
  it("converts GeoJSON longitude/latitude and full addresses without a Google key", async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL) => Response.json({features:[house]}));
    vi.stubGlobal("fetch",fetcher);
    const result = await geocodeWithPhoton("3510 South Michigan Avenue Chicago");
    expect(result).toEqual({lat:41.83055,lng:-87.62412,formattedAddress:"Police Headquarters, 3510 South Michigan Avenue, Chicago, Illinois, 60653",approximate:false});
    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.hostname).toBe("photon.komoot.io");
    expect(url.searchParams.get("bbox")).toBe("-87.95,41.64,-87.52,42.03");
    expect(url.searchParams.has("key")).toBe(false);
  });
  it("rejects a street midpoint when a numbered address was not matched", async () => {
    vi.stubGlobal("fetch",vi.fn(async () => Response.json({features:[{...house,properties:{name:"South Stony Island Avenue",type:"street"}}]})));
    await expect(geocodeWithPhoton("7900 South Stony Island Avenue")).rejects.toThrow("could not be found");
  });
  it("preserves selected coordinates instead of moving to the nearest address", async () => {
    vi.stubGlobal("fetch",vi.fn(async () => Response.json({features:[house]})));
    const result = await geocodeWithPhoton({lat:41.831,lng:-87.625});
    expect(result).toMatchObject({lat:41.831,lng:-87.625});
  });
  it("caches suggestions and ignores invalid coordinates", async () => {
    const fetcher = vi.fn(async () => Response.json({features:[house,{...house,geometry:{type:"Point",coordinates:[999,999]}}]}));
    vi.stubGlobal("fetch",fetcher);
    expect(await photonSuggestions("headquarters cache test")).toHaveLength(1);
    expect(await photonSuggestions("headquarters cache test")).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("reports provider failures without manufacturing a location", async () => {
    vi.stubGlobal("fetch",vi.fn(async () => new Response("Unavailable",{status:503})));
    await expect(photonSuggestions("provider unavailable test")).rejects.toThrow("temporarily unavailable");
  });
});
