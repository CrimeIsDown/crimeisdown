import radioIds from "../../../public/data/city_data/radio_ids.json";
import ucrCodes from "../../../public/data/city_data/ucr_codes.json";

export type RadioIdRow = {
  Agency: string;
  ID_Number: string;
  Level_1: string;
  Level_2: string;
  Level_3: string;
  Level_4: string;
};

export type RadioIdLookupRow = {
  agency: string;
  level1: string;
  level2: string;
  level3: string;
  level4: string;
};

export type UcrCodeRow = {
  ucrCode: string;
  primaryDesc: string;
  secondaryDesc: string;
  indexCode: string;
};

export type UcrCodeLookupRow = {
  primaryDesc: string;
  secondaryDesc: string;
  indexCode: string;
};

export function loadRadioIds() {
  return radioIds as RadioIdRow[];
}

export function loadUcrCodes() {
  return ucrCodes as UcrCodeRow[];
}
