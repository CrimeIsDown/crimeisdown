import { describe, expect, it } from "vitest";

import type { RadioIdRow, UcrCodeRow } from "./data";
import { lookupRadioId, lookupUcrCode, searchRadioIds, searchUcrCodes } from "./search";

const radioRows: RadioIdRow[] = [
  {
    Agency: "CPD",
    ID_Number: "100X",
    Level_1: "City",
    Level_2: "",
    Level_3: "Special Events",
    Level_4: "Unit $1",
  },
  {
    Agency: "OEMC",
    ID_Number: "100X",
    Level_1: "City",
    Level_2: "",
    Level_3: "Special Events",
    Level_4: "Secondary",
  },
];

const ucrRows: UcrCodeRow[] = [
  {
    ucrCode: "041A",
    primaryDesc: "Assault",
    secondaryDesc: "Aggravated Battery",
    indexCode: "Y",
  },
];

describe("reference search helpers", () => {
  it("matches radio ids exactly and applies legacy substitutions", () => {
    const matches = searchRadioIds("100x", radioRows);
    expect(matches).toHaveLength(2);

    const result = lookupRadioId("100x", radioRows);
    expect(result).toEqual({
      agency: "OEMC",
      level1: "City",
      level2: "",
      level3: "Special Events",
      level4: "Secondary",
    });
  });

  it("returns default radio id values when no match exists", () => {
    expect(lookupRadioId("9999", radioRows)).toEqual({
      agency: "N/A",
      level1: "N/A",
      level2: "N/A",
      level3: "N/A",
      level4: "N/A",
    });
  });

  it("matches ucr codes regardless of punctuation", () => {
    expect(searchUcrCodes("041-a", ucrRows)).toHaveLength(1);
    expect(lookupUcrCode("041-a", ucrRows)).toEqual({
      primaryDesc: "Assault",
      secondaryDesc: "Aggravated Battery",
      indexCode: "Y",
    });
  });

  it("returns default ucr values when no match exists", () => {
    expect(lookupUcrCode("9999", ucrRows)).toEqual({
      primaryDesc: "Not Found",
      secondaryDesc: "Not Found",
      indexCode: "N/A",
    });
  });
});
