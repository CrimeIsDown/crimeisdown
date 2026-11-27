import { loadRuntimeConfig } from "@/lib/runtime-config";
import CalendarInput from "./CalendarInput";
import { useEffect, useState } from "react";

import {
  buildArchiveDownloadParams,
  hasRepeatedChicagoHour,
  shouldUseBroadcastify,
} from "@/lib/audio/archive";
import type { ArchiveFeed } from "@/lib/audio/data";

type Props = {
  feeds: ArchiveFeed[];
  initialFeed?: string;
};

export default function ArchiveDownloadForm({ feeds, initialFeed }: Props) {
  const initialDatetime = getChicagoDatetimeInput();
  const [feed, setFeed] = useState(() => getInitialFeed(feeds, initialFeed));
  const [datetime, setDatetime] = useState(initialDatetime);
  const [occurrence, setOccurrence] = useState<"first" | "second">("first");
  const [error, setError] = useState("");
  const showOccurrence =
    shouldUseBroadcastify(feed, datetime) && hasRepeatedChicagoHour(datetime);

  useEffect(() => {
    if (feed) {
      return;
    }

    const feedParam = new URL(window.location.href).searchParams.get("feed");
    if (feedParam && feeds.some((candidate) => candidate.value === feedParam)) {
      setFeed(feedParam);
    }
  }, [feed, feeds]);

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
      const params = buildArchiveDownloadParams(
        feed,
        datetime,
        showOccurrence ? occurrence : "first",
      );
      window.open(
        `${loadRuntimeConfig().API_BASE_URL}/recordings/download-audio?${params.toString()}`,
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
          onChange={(event) => {
            setFeed(event.target.value);
            setOccurrence("first");
          }}
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
        <CalendarInput
          id="archive-datetime"
          className="form-control"
          value={datetime}
          onValueChange={(value) => {
            setDatetime(value);
            setOccurrence("first");
          }}
        />
      </div>

      {showOccurrence && (
        <div className="mb-3">
          <label htmlFor="archive-occurrence">Which 1 a.m. hour?</label>
          <select
            id="archive-occurrence"
            className="form-control"
            value={occurrence}
            onChange={(event) =>
              setOccurrence(event.target.value === "second" ? "second" : "first")
            }
          >
            <option value="first">First 1 a.m. (CDT)</option>
            <option value="second">Second 1 a.m. (CST)</option>
          </select>
        </div>
      )}

      {error ? <p className="text-bg-danger fw-bold mt-2 p-1">{error}</p> : null}

      <button type="submit" className="btn btn-primary">Download recording</button>
    </form>
  );
}

function getInitialFeed(feeds: ArchiveFeed[], initialFeed: string | undefined) {
  if (initialFeed && feeds.some((candidate) => candidate.value === initialFeed)) {
    return initialFeed;
  }

  // Start with the same value as the server-rendered select. The effect applies
  // URL parameters after hydration so React updates the selected option.
  return "";
}

function getChicagoDatetimeInput() {
  const now = new Date(Date.now() - 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
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
  const minute = "00";

  return `${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${minute}`;
}
