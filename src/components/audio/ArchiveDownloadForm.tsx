import { useState } from "react";

import {
  AUDIO_ARCHIVE_ENDPOINT,
  buildArchiveDownloadParams,
} from "@/lib/audio/archive";
import type { ArchiveFeed } from "@/lib/audio/data";

type Props = {
  feeds: ArchiveFeed[];
  initialFeed?: string;
};

export default function ArchiveDownloadForm({ feeds, initialFeed }: Props) {
  const initialDatetime = getChicagoDatetimeInput();
  const [feed, setFeed] = useState(
    initialFeed && feeds.some((candidate) => candidate.value === initialFeed)
      ? initialFeed
      : "",
  );
  const [datetime, setDatetime] = useState(initialDatetime);
  const [error, setError] = useState("");

  function onSubmit(event: { preventDefault(): void }) {
    event.preventDefault();
    setError("");

    if (!feed) {
      setError("Pick a radio channel.");
      return;
    }

    if (!datetime) {
      setError("Pick a Chicago time for the recording.");
      return;
    }

    try {
      const params = buildArchiveDownloadParams(feed, datetime);
      window.open(
        `${AUDIO_ARCHIVE_ENDPOINT}?${params.toString()}`,
        "_blank",
        "noopener,noreferrer",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not build the archive request.",
      );
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="mb-3">
        <label htmlFor="archive-feed">Radio channel</label>
        <select
          id="archive-feed"
          className="form-control"
          value={feed}
          onChange={(event) => setFeed(event.target.value)}
        >
          <option value="" disabled>
            Select channel
          </option>
          {feeds.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label htmlFor="archive-datetime">Time of recording (in US Central time)</label>
        <input
          id="archive-datetime"
          className="form-control"
          type="datetime-local"
          value={datetime}
          onChange={(event) => setDatetime(event.target.value)}
        />
      </div>

      {error ? <p className="text-bg-danger fw-bold mt-2 p-1">{error}</p> : null}

      <button type="submit" className="btn btn-primary">Download recording</button>
    </form>
  );
}

function getChicagoDatetimeInput() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const map = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  const year = map.year;
  const month = map.month;
  const day = map.day;
  const hour = Number(map.hour) || 0;
  const minute = map.minute ?? "00";

  return `${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${minute}`;
}
