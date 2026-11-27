import type { Page } from "@playwright/test";

// Fixed Meilisearch provider responses. The real InstantSearch widgets and URL
// routing run in the browser; tests also assert the outgoing query/filter values.
export async function installSearchProvider(page: Page) {
  await page.route("http://127.0.0.1:8765/multi-search", async (route) => {
    const { queries } = route.request().postDataJSON();
    if (queries.some((query: { q?: string }) => query.q === "provider-error")) {
      return route.fulfill({
        status: 503,
        json: { message: "Search unavailable" },
      });
    }
    const results = queries.map((query: Record<string, unknown>) => {
      const text = String(query.q || "");
      const hit = {
        id: "e2e-call-1",
        start_time: 1793422800,
        call_length: 1,
        short_name: "chi_cpd",
        talkgroup: 7,
        talkgroup_tag: "Chi PD Zone 7",
        talkgroup_group: "Police",
        talkgroup_group_tag: "Law Dispatch",
        talkgroup_description: "Zone 7 Dispatch",
        audio_type: "digital",
        transcript_plaintext:
          "Dispatch: respond to Michigan Avenue for a traffic stop.",
        raw_transcript:
          '[[null,"Dispatch: respond to Michigan Avenue for a traffic stop."]]',
        raw_metadata: "{}",
        raw_audio_url: "http://127.0.0.1:8765/e2e/recording.mp3",
      };
      const hits = text === "nomatch" ? [] : [hit];
      return {
        indexUid: query.indexUid,
        query: text,
        processingTimeMs: 1,
        hits,
        page: query.page || 1,
        hitsPerPage: query.hitsPerPage ?? 20,
        totalHits: hits.length,
        totalPages: hits.length ? 1 : 0,
        estimatedTotalHits: hits.length,
        offset: 0,
        limit: 20,
        facetDistribution: {
          short_name: { chi_cpd: 1, chi_oemc: 1 },
          talkgroup_group: { Police: 1 },
          talkgroup_tag: {
            "Chi PD Zone 7": 1,
            "CFD Fire Englewd": 1,
            "CFD EMS Englwd": 1,
          },
          talkgroup_group_tag: { "Law Dispatch": 1 },
          "talkgroup_hierarchy.lvl0": { chi_cpd: 1 },
        },
        facetStats: {
          start_time: { min: hit.start_time, max: hit.start_time },
        },
      };
    });
    await route.fulfill({ json: { results } });
  });
}
