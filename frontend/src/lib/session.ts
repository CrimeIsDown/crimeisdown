import { loadRuntimeConfig } from "@/lib/runtime-config";

export type CrimeIsDownUser = {
  name?: string;
  email?: string;
  patreon_tier?: {
    name?: string;
  };
};

export async function getCurrentUser(fetcher: typeof fetch = fetch) {
  const config = loadRuntimeConfig();
  const headers: HeadersInit = {
    Accept: "application/json",
  };

  if (config.API_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${config.API_AUTH_TOKEN}`;
  }

  const response = await fetcher(`${config.API_BASE_URL}/api/user`, {
    headers,
    credentials: "include",
  });

  if (response.status !== 200) {
    return null;
  }

  return (await response.json()) as CrimeIsDownUser;
}
