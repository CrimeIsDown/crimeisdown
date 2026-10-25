export const AUDIO_ARCHIVE_ENDPOINT =
  "https://api.crimeisdown.com/recordings/download-audio";

export const archivePricing = [
  { label: "Free", downloadsPerDay: "5", href: null },
  {
    label: "$1/mo Patron",
    downloadsPerDay: "10",
    href: "https://www.patreon.com/checkout/EricTendian/1260234",
  },
  {
    label: "$5/mo Patron",
    downloadsPerDay: "20",
    href: "https://www.patreon.com/checkout/EricTendian/1260095",
  },
  {
    label: "$10/mo Patron",
    downloadsPerDay: "30",
    href: "https://www.patreon.com/checkout/EricTendian/1260096",
  },
  {
    label: "$20/mo Patron",
    downloadsPerDay: "50",
    href: "https://www.patreon.com/checkout/EricTendian/1260098",
  },
  {
    label: "$50/mo Patron",
    downloadsPerDay: "Unlimited",
    href: "https://www.patreon.com/checkout/EricTendian/1260099",
  },
] as const;

export const encryptedCutoverByFeed: Record<string, string> = {
  zone1: "2023-01-30 06:00:00",
  zone2: "2023-01-03 06:00:00",
  zone3: "2022-09-02 00:00:00",
  zone4: "2023-03-07 06:00:00",
  zone5: "2022-06-30 12:00:00",
  zone6: "2022-08-12 00:00:00",
  zone7: "2022-06-30 12:00:00",
  zone8: "2022-05-25 00:00:00",
  zone9: "2022-05-12 12:00:00",
  zone10: "2022-10-25 06:00:00",
  zone11: "2023-04-04 12:00:00",
  zone12: "2022-11-15 07:00:00",
  zone13: "2022-10-04 06:00:00",
};

export type ArchivePlayback = {
  url: string;
  filename: string;
  type: string;
};

export function inferArchivePlayback(
  url: string | null,
  type?: string | null,
): ArchivePlayback | null {
  if (!url) return null;
  try {
    if (!["http:", "https:"].includes(new URL(url).protocol)) return null;
  } catch {
    return null;
  }

  const filename = safeFilenameFromUrl(url);
  return {
    url,
    filename,
    type: type ?? guessMediaType(filename),
  };
}

export function buildArchiveDownloadParams(
  feed: string,
  datetimeLocal: string,
) {
  const params = new URLSearchParams();
  params.set("feed", feed);
  params.set("datetime", new Date(chicagoTimestamp(datetimeLocal)).toISOString());

  if (shouldUseBroadcastify(feed, datetimeLocal)) {
    params.set("broadcastify", "1");
  }

  return params;
}

export function formatArchiveDatetime(datetimeLocal: string) {
  const match = datetimeLocal.match(
    /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2})$/,
  );

  if (!match?.groups) {
    throw new Error("Use a valid date and time.");
  }

  const year = Number(match.groups.year);
  const month = Number(match.groups.month);
  const day = Number(match.groups.day);
  const hour24 = Number(match.groups.hour);
  const minute = Number(match.groups.minute);
  const hour12 = hour24 % 12 || 12;
  const suffix = hour24 >= 12 ? "PM" : "AM";

  return `${month}/${day}/${year} ${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function shouldUseBroadcastify(feed: string, datetimeLocal: string) {
  const cutoff = encryptedCutoverByFeed[feed];
  if (!cutoff) return false;

  return compareArchiveDateTimes(datetimeLocal, cutoff) >= 0;
}

export function compareArchiveDateTimes(left: string, right: string) {
  const leftParts = parseArchiveDateTime(left);
  const rightParts = parseCutoverDateTime(right);

  if (!leftParts || !rightParts) {
    return -1;
  }

  const leftValue = Date.UTC(
    leftParts.year,
    leftParts.month - 1,
    leftParts.day,
    leftParts.hour,
    leftParts.minute,
  );
  const rightValue = Date.UTC(
    rightParts.year,
    rightParts.month - 1,
    rightParts.day,
    rightParts.hour,
    rightParts.minute,
  );

  return Math.sign(leftValue - rightValue);
}

export function parseArchiveDateTime(value: string) {
  const match = value.match(
    /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2})$/,
  );

  if (!match?.groups) return null;

  return {
    year: Number(match.groups.year),
    month: Number(match.groups.month),
    day: Number(match.groups.day),
    hour: Number(match.groups.hour),
    minute: Number(match.groups.minute),
  };
}

function parseCutoverDateTime(value: string) {
  const match = value.match(
    /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2}) (?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})$/,
  );

  if (!match?.groups) return null;

  return {
    year: Number(match.groups.year),
    month: Number(match.groups.month),
    day: Number(match.groups.day),
    hour: Number(match.groups.hour),
    minute: Number(match.groups.minute),
    second: Number(match.groups.second),
  };
}

function safeFilenameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const filename = parsed.pathname.split("/").filter(Boolean).pop();
    return filename ?? "archive";
  } catch {
    return url.split("/").filter(Boolean).pop() ?? "archive";
  }
}

function guessMediaType(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "m4a":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "wav":
      return "audio/wav";
    case "mp3":
    default:
      return "audio/mpeg";
  }
}

/** Interpret the form's wall clock in Chicago, regardless of the viewer's timezone. */
export function chicagoTimestamp(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Use a valid date and time.");
  const target = Date.parse(value + ":00Z");
  if (
    !Number.isFinite(target) ||
    new Date(target).toISOString().slice(0, 16) !== value
  )
    throw new Error("Use a valid date and time.");
  let estimate = target;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(estimate).map((p) => [p.type, p.value]),
    );
    const represented = Date.parse(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`,
    );
    if (represented === target) return estimate;
    estimate += target - represented;
  }
  throw new Error(
    "This time does not exist in Chicago because of daylight saving time.",
  );
}

export function buildRangeExportPayload(
  feed: string,
  start: string,
  end: string,
) {
  if (!feed || !start || !end)
    throw new Error("Feed, start time, and end time are required.");
  const duration = chicagoTimestamp(end) - chicagoTimestamp(start);
  if (duration <= 0) throw new Error("End time must be after start time.");
  if (!start.endsWith(":00") || !end.endsWith(":00"))
    throw new Error(
      "Start and end times must be hour-aligned (mm:ss = 00:00).",
    );
  if (duration > 24 * 3600 * 1000)
    throw new Error("Time range must be 24 hours or less.");
  const cutoff = encryptedCutoverByFeed[feed]?.replace(" ", "T").slice(0, 16);
  if (cutoff && start < cutoff && end > cutoff)
    throw new Error(
      "This range crosses the encrypted cutover time. Please split it into two separate exports.",
    );
  return {
    feed,
    start_datetime: start.replace("T", " ") + ":00",
    end_datetime: end.replace("T", " ") + ":00",
    broadcastify: shouldUseBroadcastify(feed, start),
  };
}
