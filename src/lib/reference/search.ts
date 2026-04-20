import type {
  RadioIdLookupRow,
  RadioIdRow,
  UcrCodeLookupRow,
  UcrCodeRow,
} from "@/lib/reference/data";

export function normalizeRadioIdQuery(query: string) {
  return query.trim().toUpperCase();
}

export function searchRadioIds(query: string, rows: RadioIdRow[]) {
  const normalized = normalizeRadioIdQuery(query);
  if (!normalized) {
    return [];
  }

  return rows.filter((row) => {
    try {
      return new RegExp(`^${row.ID_Number}$`).test(normalized);
    } catch {
      return row.ID_Number.toUpperCase() === normalized;
    }
  });
}

export function lookupRadioId(query: string, rows: RadioIdRow[]): RadioIdLookupRow {
  const normalized = normalizeRadioIdQuery(query);
  const defaultResult: RadioIdLookupRow = {
    agency: "N/A",
    level1: "N/A",
    level2: "N/A",
    level3: "N/A",
    level4: "N/A",
  };

  if (!normalized) {
    return defaultResult;
  }

  const matches = searchRadioIds(normalized, rows);
  if (!matches.length) {
    return defaultResult;
  }

  const result: RadioIdLookupRow = {
    agency: "",
    level1: "",
    level2: "",
    level3: "",
    level4: "",
  };

  for (const match of matches) {
    if (match.Agency.length) {
      result.agency = match.Agency;
    }
    if (match.Level_1.length) {
      result.level1 = match.Level_1;
    }
    if (match.Level_2.length) {
      result.level2 = match.Level_2;
    }
    if (match.Level_3.length) {
      result.level3 = match.Level_3;
    }
    if (match.Level_4.length) {
      if (match.Level_4.match(/\$1$/)) {
        const digits = normalized.match(/\d+/)?.[0] ?? "";
        result.level4 = match.Level_4.replace("$1", digits);
      } else {
        result.level4 = match.Level_4;
      }
    }
  }

  return result;
}

export function normalizeUcrQuery(query: string) {
  return query.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function searchUcrCodes(query: string, rows: UcrCodeRow[]) {
  const normalized = normalizeUcrQuery(query);
  if (!normalized) {
    return [];
  }

  return rows.filter((row) => normalizeUcrQuery(row.ucrCode) === normalized);
}

export function lookupUcrCode(query: string, rows: UcrCodeRow[]): UcrCodeLookupRow {
  const normalized = normalizeUcrQuery(query);
  const defaultResult: UcrCodeLookupRow = {
    primaryDesc: "Not Found",
    secondaryDesc: "Not Found",
    indexCode: "N/A",
  };

  if (!normalized) {
    return defaultResult;
  }

  const match = rows.find((row) => normalizeUcrQuery(row.ucrCode) === normalized);
  if (!match) {
    return defaultResult;
  }

  return {
    primaryDesc: match.primaryDesc,
    secondaryDesc: match.secondaryDesc,
    indexCode: match.indexCode,
  };
}
