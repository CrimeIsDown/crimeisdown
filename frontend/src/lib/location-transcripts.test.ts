import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupLocationContext } from "./location/engine";
import { locationTranscriptSearch } from "./location-transcripts";
import type { LocationContextResult } from "./location/types";

const assets = (path: string) => readFile(new URL(`../../public${path}`, import.meta.url), "utf8");
afterEach(() => vi.unstubAllGlobals());

describe("homepage location transcript demo", () => {
  it("uses actual Chicago map datasets to select Zone 8 and Fire Englewood", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      status: "OK",
      results: [{ formatted_address: "7900 S Stony Island Ave, Chicago, IL", geometry: { location: { lat: 41.7505, lng: -87.5855 }, location_type: "ROOFTOP" } }],
    })));
    const location = await lookupLocationContext({ origin: "https://example.test", q: "7900 S Stony Island", assetText: assets, googleGeocodingKey: "test" });
    expect(location.meta.inChicago).toBe(true);
    expect(location.police?.zone?.num).toBe("8");
    expect(location.fire?.channel).toBe("Englewood");
    const result = locationTranscriptSearch(location);
    const url = new URL(result.href, "https://example.test");
    expect(url.pathname).toBe("/transcripts/search");
    expect(result.label).toBe("CPD Zone 8 and CFD Fire Englewood");
    expect(url.searchParams.get("calls_demo[refinementList][talkgroup_tag][0]")).toBe("Chi PD Zone 8");
    expect(url.searchParams.get("calls_demo[refinementList][talkgroup_tag][1]")).toBe("CFD Fire Englewd");
    expect(url.searchParams.get("calls_demo[refinementList][talkgroup_tag][3]")).toBe("CFD Fire S");
    expect([...url.searchParams.keys()].every(key => key.startsWith("calls_demo["))).toBe(true);
    expect(result.href).not.toContain("geoSearch");
  });

  it("rejects outside-city locations rather than showing unrelated transcripts", () => {
    expect(() => locationTranscriptSearch({ meta: { inChicago: false } } as LocationContextResult)).toThrow("Chicago addresses only");
  });

  it("does not silently search all channels when the map cannot identify them", () => {
    expect(() => locationTranscriptSearch({ meta: { inChicago: true }, police: {} } as LocationContextResult)).toThrow("both radio channels");
  });

  it("selects northern fire aliases without including southern channels", () => {
    const result = locationTranscriptSearch({
      meta: { inChicago: true },
      police: { zone: { num: "2" } },
      fire: { channel: "Main" },
    } as LocationContextResult);
    const values = [...new URL(result.href, "https://example.test").searchParams.values()];
    expect(values).toContain("Chi PD Zone 2");
    expect(values).toContain("CFD Fire Main");
    expect(values).toContain("CFD Fire N");
    expect(values).not.toContain("CFD Fire S");
  });
});
