import streams from "../../../public/data/audio_data/online_streams.json";

export type AudioStream = {
  name: string;
  shortname?: string;
  description: string;
  frequency: string;
  slug: string;
  openmhz?: string | null;
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

export const archiveFeeds: ArchiveFeed[] = [
  { value: 'citywide1', label: 'Citywide 1' },
  { value: 'citywide2', label: 'Citywide 2' },
  { value: 'citywide3', label: 'Citywide 3' },
  { value: 'citywide4', label: 'Citywide 4' },
  { value: 'citywide5', label: 'Citywide 5' },
  { value: 'citywide6', label: 'Citywide 6' },
  { value: 'citywide7', label: 'Citywide 7' },
  { value: 'zone1', label: 'Zone 1 (016/017)' },
  { value: 'zone2', label: 'Zone 2 (019)' },
  { value: 'zone3', label: 'Zone 3 (012/014)' },
  { value: 'zone4', label: 'Zone 4 (001/018)' },
  { value: 'zone5', label: 'Zone 5 (002) - no longer in use' },
  { value: 'zone6', label: 'Zone 6 (007/008)' },
  { value: 'zone7', label: 'Zone 7 (002/003)' },
  { value: 'zone8', label: 'Zone 8 (004/006)' },
  { value: 'zone9', label: 'Zone 9 (005/022)' },
  { value: 'zone10', label: 'Zone 10 (010/011)' },
  { value: 'zone11', label: 'Zone 11 (020/024)' },
  { value: 'zone12', label: 'Zone 12 (015/025)' },
  { value: 'zone13', label: 'Zone 13 (009)' },
  { value: 'fire_main', label: 'CFD Fire Main (North)' },
  { value: 'fire_englewood', label: 'CFD Fire Englewood (South)' },
  { value: 'ems_main', label: 'CFD EMS Main (North)' },
  { value: 'ems_englewood', label: 'CFD EMS Englewood (South)' },
];

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
