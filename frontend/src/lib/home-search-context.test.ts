import { describe, expect, it } from "vitest";
import { homeSearchContext, sirensPrefillUrl } from "./home-search-context";
import { locationTranscriptSearch } from "./location-transcripts";
import type { LocationContextResult } from "./location/types";

describe("membership-aware homepage search", () => {
  it("keeps guests and signed-in nonmembers on the demo", () => {
    expect(homeSearchContext(null).index).toBe("calls_demo");
    expect(homeSearchContext({patreon_tier:null}).index).toBe("calls_demo");
    expect(homeSearchContext({patreon_tier:{features:{transcript_search:false}}}).button).toBe("See sample transcripts");
  });
  it("routes eligible members to the current UTC monthly index", () => {
    const mode=homeSearchContext({patreon_tier:{features:{transcript_search:true}}},new Date("2026-11-01T00:30:00Z"));
    expect(mode.index).toBe("calls_2026_11");
    expect(mode.button).toBe("Search transcripts");
    expect(mode.help).toContain("current transcripts");
    const result=locationTranscriptSearch({meta:{inChicago:true},police:{zone:{num:"8"}},fire:{channel:"Englewood"}} as LocationContextResult,mode.index);
    const params=new URL(result.href,"https://example.test").searchParams;
    expect([...params.keys()].every(key=>key.startsWith("calls_2026_11["))).toBe(true);
    expect(params.get("calls_2026_11[refinementList][talkgroup_tag][0]")).toBe("Chi PD Zone 8");
    expect(params.get("calls_2026_11[refinementList][talkgroup_tag][2]")).toBe("CFD EMS Englwd");
  });
  it("builds an encoded draft fragment without transmitting the address in query parameters", () => {
    const url=new URL(sirensPrefillUrl("83rd & Stony Island, Chicago"));
    expect(url.origin).toBe("https://sirens.app");
    expect(url.search).toBe("");
    expect(new URLSearchParams(url.hash.slice(1)).get("prompt")).toContain("83rd & Stony Island, Chicago");
    expect(sirensPrefillUrl(" ")).toBe("https://sirens.app/");
  });
});
