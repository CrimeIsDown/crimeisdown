import { describe, expect, it } from "vitest";
import {
  switchTranscriptIndex,
  transcriptIndex,
  transcriptText,
  renderHit,
  transcriptMonth,
} from "./transcript-search";

describe("Ember-compatible transcript state", () => {
  it("chooses monthly indexes in UTC when Chicago is still in the previous month", () => {
    expect(transcriptMonth(new Date("2026-10-31T19:30:00-05:00"))).toBe("2026-11");
  });
  it("accepts existing monthly deep links", () => {
    expect(
      transcriptIndex("?calls_2025_10%5Bquery%5D=dispatch", "calls_2026_10"),
    ).toBe("calls_2025_10");
    expect(transcriptIndex("?unrelated=1", "calls_2026_10")).toBe(
      "calls_2026_10",
    );
  });
  it("selects an archive month before any query has been entered", () => {
    const result = switchTranscriptIndex(
      new URL("https://crimeisdown.com/transcripts/search"),
      "calls_2026_10",
      "calls_2025_10",
    );
    expect(transcriptIndex(result.search, "calls_2026_10")).toBe(
      "calls_2025_10",
    );
  });
  it("preserves query, facets, and sort while changing month, clearing stale dates/page", () => {
    const url = new URL(
      "https://crimeisdown.com/transcripts/search?calls_2026_10%5Bquery%5D=dispatch&calls_2026_10%5BrefinementList%5D%5Bshort_name%5D%5B0%5D=chi_cpd&calls_2026_10%5BsortBy%5D=calls_2026_10%3Astart_time%3Adesc&calls_2026_10%5Brange%5D%5Bstart_time%5D=100%3A200&calls_2026_10%5Bpage%5D=3#hit-1",
    );
    const result = switchTranscriptIndex(
      url,
      "calls_2026_10",
      "calls_2025_10",
      "300:400",
    );
    expect(result.searchParams.get("calls_2025_10[query]")).toBe("dispatch");
    expect(
      result.searchParams.get("calls_2025_10[refinementList][short_name][0]"),
    ).toBe("chi_cpd");
    expect(result.searchParams.get("calls_2025_10[sortBy]")).toBe(
      "calls_2025_10:start_time:desc",
    );
    expect(result.searchParams.get("calls_2025_10[range][start_time]")).toBe(
      "300:400",
    );
    expect(result.searchParams.has("calls_2025_10[page]")).toBe(false);
    expect(result.hash).toBe("#hit-1");
  });
  it("reads the original serialized transcript segments without requiring a migration", () => {
    expect(
      transcriptText({
        raw_transcript: '[[null,"Dispatch"],[null,"respond"]]',
      }),
    ).toBe("Dispatch\nrespond");
    expect(transcriptText({ transcript_plaintext: "Existing text" })).toBe(
      "Existing text",
    );
    expect(transcriptText({ raw_transcript: "invalid" })).toBe(
      "Transcript unavailable.",
    );
  });
});

describe("legacy call rendering", () => {
  it("keeps transcript and metadata markup inert while preserving safe search highlights", () => {
    const result = renderHit(
      {
        id: "1",
        start_time: 1000,
        raw_metadata: "{}",
        raw_transcript: JSON.stringify([
          [
            { src: 123, tag: "<img src=x onerror=alert(1)>" },
            "<script>alert(1)</script>",
          ],
        ]),
        raw_audio_url: "javascript:alert(1)",
      },
      "calls_2026_10",
      () => "https://crimeisdown.com/transcripts/search",
    );
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("<img");
    expect(result).not.toContain('src="javascript:');
    expect(result).toContain("&lt;script&gt;");
  });
  it("preserves exact-call and surrounding-call URLs for the same stored record", () => {
    const states: unknown[] = [];
    const result = renderHit(
      {
        id: "existing-1",
        start_time: 10000,
        talkgroup_tag: "Zone 1",
        short_name: "chi_cpd",
        raw_metadata: '{"encrypted":1}',
        raw_transcript: '[[null,"Preserved recording"]]',
      },
      "calls_2026_10",
      (state) => {
        states.push(state);
        return "https://crimeisdown.com/transcripts/search";
      },
    );
    expect(states).toContainEqual({
      calls_2026_10: {
        refinementList: { talkgroup_tag: ["Zone 1"] },
        range: { start_time: "10000:10000" },
      },
    });
    expect(states).toContainEqual({
      calls_2026_10: {
        sortBy: "calls_2026_10:start_time:desc",
        hitsPerPage: 60,
        refinementList: { talkgroup_tag: ["Zone 1"] },
        range: { start_time: "8800:10600" },
      },
    });
    expect(result).toContain("Encrypted / Delayed 30mins");
    expect(result).toContain("Preserved recording");
  });
});
