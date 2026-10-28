import type { LocationContextResult } from "./location/types";

/** Use the same channel assignments as the map, including historical CFD names. */
export function locationTranscriptSearch(location: LocationContextResult, index = "calls_demo") {
  if (index !== "calls_demo" && !/^calls_\d{4}_\d{2}$/.test(index)) throw new Error("Invalid transcript index");
  if (!location.meta.inChicago) {
    throw new Error("This search currently supports Chicago addresses only.");
  }
  const zone = location.police?.zone?.num;
  const fire = location.fire?.channel;
  if (!zone || !/^(?:[1-9]|1[0-3])$/.test(zone) || !["Main", "Englewood"].includes(fire || "")) {
    throw new Error("We couldn’t identify both radio channels for that address. Try a more specific Chicago street address.");
  }
  const tags = [
    `Chi PD Zone ${zone}`,
    ...(fire === "Englewood"
      ? ["CFD Fire Englewd", "CFD Fire Engwd", "CFD Fire S"]
      : ["CFD Fire Main", "CFD Fire N"]),
  ];
  const params = new URLSearchParams({
    [`${index}[sortBy]`]: `${index}:start_time:desc`,
  });
  for (const [attribute, values] of Object.entries({
    short_name: ["chi_cpd", "chi_oemc", "chi_cfd"],
    talkgroup_tag: tags,
  })) {
    values.forEach((value, position) => {
      params.set(`${index}[refinementList][${attribute}][${position}]`, value);
    });
  }
  return {
    href: `/transcripts/search?${params}`,
    label: `CPD Zone ${zone} and CFD Fire ${fire}`,
  };
}
