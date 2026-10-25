import { describe, expect, test } from "vitest";

import { loadRuntimeConfig, setRuntimeConfigValue } from "./runtime-config";

function createStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  } as unknown as Storage;
}

describe("runtime config", () => {
  test("loads defaults with localStorage overrides", () => {
    const storage = createStorage();
    storage.setItem("API_BASE_URL", "https://local.test");

    const config = loadRuntimeConfig(storage);

    expect(config.API_BASE_URL).toBe("https://local.test");
    expect(config.API_AUTH_TOKEN).toBe("");
  });

  test("sets and clears override values", () => {
    const storage = createStorage();

    setRuntimeConfigValue("API_AUTH_TOKEN", "token", storage);
    expect(loadRuntimeConfig(storage).API_AUTH_TOKEN).toBe("token");

    setRuntimeConfigValue("API_AUTH_TOKEN", "", storage);
    expect(loadRuntimeConfig(storage).API_AUTH_TOKEN).toBe("");
  });
});
