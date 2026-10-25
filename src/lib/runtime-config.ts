export const runtimeConfigDefaults = {
  API_BASE_URL: import.meta.env.PUBLIC_API_BASE_URL || "https://api.crimeisdown.com",
  API_AUTH_TOKEN: "",
  MEILISEARCH_URL: "https://search.crimeisdown.com",
  MEILISEARCH_KEY: "",
  // Public search-only demo credential already shipped by the Ember frontend.
  MEILISEARCH_DEMO_KEY: "REDACTED_PUBLIC_CREDENTIAL",
  SEARCH_INDEX: "",
  TYPESENSE_KEY: "",
} as const;

export type RuntimeConfigKey = keyof typeof runtimeConfigDefaults;
export type RuntimeConfig = Record<RuntimeConfigKey, string>;

export function loadRuntimeConfig(storage: Storage | undefined = globalThis.localStorage) {
  const config: RuntimeConfig = { ...runtimeConfigDefaults };

  try {
    for (const key of Object.keys(config) as RuntimeConfigKey[]) {
      const value = storage?.getItem(key);
      if (value) {
        config[key] = value;
      }
    }
  } catch {
    // localStorage may be unavailable in private or server contexts.
  }

  return config;
}

export function setRuntimeConfigValue(
  key: RuntimeConfigKey,
  value: string,
  storage: Storage | undefined = globalThis.localStorage,
) {
  try {
    if (value) {
      storage?.setItem(key, value);
    } else {
      storage?.removeItem(key);
    }
  } catch {
    // localStorage may be unavailable in private or server contexts.
  }
}
