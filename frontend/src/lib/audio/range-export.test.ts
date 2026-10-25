import { describe, expect, it } from "vitest";
import {
  buildRangeExportPayload,
  chicagoTimestamp,
  inferArchivePlayback,
  buildArchiveDownloadParams,
} from "./archive";

describe("preserved archive range semantics", () => {
  it("sends hourly downloads as the same UTC instants as Ember", () => {
    expect(buildArchiveDownloadParams("zone7", "2026-10-22T02:00").get("datetime")).toBe("2026-10-22T07:00:00.000Z");
    expect(buildArchiveDownloadParams("zone7", "2026-01-10T12:00").get("datetime")).toBe("2026-01-10T18:00:00.000Z");
  });
  it("interprets winter and summer forms in Chicago, independent of the browser timezone", () => {
    expect(new Date(chicagoTimestamp("2026-01-10T12:00")).toISOString()).toBe(
      "2026-01-10T18:00:00.000Z",
    );
    expect(new Date(chicagoTimestamp("2026-07-10T12:00")).toISOString()).toBe(
      "2026-07-10T17:00:00.000Z",
    );
  });
  it("counts the extra fall-back hour toward the 24 hour limit", () => {
    expect(() =>
      buildRangeExportPayload("zone1", "2026-10-31T12:00", "2026-11-01T12:00"),
    ).toThrow("24 hours");
  });
  it("rejects non-existent spring-forward times", () => {
    expect(() => chicagoTimestamp("2026-03-08T02:00")).toThrow(
      "does not exist",
    );
  });
  it("prevents ranges crossing the feed's encryption cutover", () => {
    expect(() =>
      buildRangeExportPayload("zone1", "2023-01-30T05:00", "2023-01-30T07:00"),
    ).toThrow("cutover");
    expect(
      buildRangeExportPayload("zone1", "2023-01-30T06:00", "2023-01-30T07:00"),
    ).toEqual({
      feed: "zone1",
      start_datetime: "2023-01-30 06:00:00",
      end_datetime: "2023-01-30 07:00:00",
      broadcastify: true,
    });
  });
  it("rejects reversed ranges and partial hours", () => {
    expect(() =>
      buildRangeExportPayload("zone1", "2026-10-20T12:00", "2026-10-20T11:00"),
    ).toThrow("after");
    expect(() =>
      buildRangeExportPayload("zone1", "2026-10-20T12:30", "2026-10-20T13:00"),
    ).toThrow("hour-aligned");
  });
});

it("keeps signed archive URLs intact and rejects executable URL schemes", () => {
  const url = "https://storage.example.com/recording.mp3?signature=preserved";
  expect(inferArchivePlayback(url)?.url).toBe(url);
  expect(inferArchivePlayback("javascript:alert(1)")).toBeNull();
  expect(
    inferArchivePlayback("data:text/html,<script>alert(1)</script>"),
  ).toBeNull();
});
