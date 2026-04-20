import streams from "../../../public/data/audio_data/online_streams.json";

export type AudioStream = {
  name: string;
  shortname?: string;
  description: string;
  frequency: string;
  slug: string;
  openmhz?: string | null;
  broadcastify?: string | null;
  broadcastifyId?: number | null;
};

export type AudioStreamGroup = {
  title: string;
  description: string;
  streams: AudioStream[];
};

export type ArchiveFeed = {
  value: string;
  label: string;
};

export const audioStreams = streams as AudioStream[];

export const archiveFeeds: ArchiveFeed[] = audioStreams.map((stream) => ({
  value: stream.slug,
  label: stream.shortname ?? stream.name,
}));

export function getFeaturedAudioStream() {
  return (
    audioStreams.find((stream) => stream.slug === "cpd_zone_scan") ??
    audioStreams[0]
  );
}

export function getAudioStreamGroups(): AudioStreamGroup[] {
  const cpd = audioStreams.filter((stream) => stream.slug.startsWith("zone"));
  const citywide = audioStreams.filter((stream) =>
    stream.slug.startsWith("citywide"),
  );
  const fireAndEms = audioStreams.filter(
    (stream) => stream.slug.startsWith("fire_") || stream.slug.startsWith("ems_"),
  );
  const other = audioStreams.filter(
    (stream) =>
      !stream.slug.startsWith("zone") &&
      !stream.slug.startsWith("citywide") &&
      !stream.slug.startsWith("fire_") &&
      !stream.slug.startsWith("ems_") &&
      stream.slug !== "cpd_zone_scan",
  );

  return [
    {
      title: "CPD zones",
      description: "Direct public links for the Chicago Police Department zones.",
      streams: cpd,
    },
    {
      title: "Citywide channels",
      description: "Citywide police channels and other broad coverage feeds.",
      streams: citywide,
    },
    {
      title: "Fire and EMS",
      description: "Chicago Fire Department and EMS audio sources.",
      streams: fireAndEms,
    },
    {
      title: "Other feeds",
      description: "Additional public scanner sources and the all-zones scanner.",
      streams: other,
    },
  ];
}
