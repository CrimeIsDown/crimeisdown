import { loadRuntimeConfig } from "./runtime-config";

/** API JSON resources are returned directly, without a wrapping data property. */
export async function legacyApi<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const config = loadRuntimeConfig();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (config.API_AUTH_TOKEN)
    headers.Authorization = `Bearer ${config.API_AUTH_TOKEN}`;
  if (method !== "GET") {
    const csrf = await fetch(config.API_BASE_URL + "/sanctum/csrf-cookie", {
      credentials: "include",
      headers,
    });
    if (!csrf.ok)
      throw new Error(
        "Could not initialize your session. Please sign in again.",
      );
    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("XSRF-TOKEN="))
      ?.slice(11);
    if (cookie) headers["X-XSRF-TOKEN"] = decodeURIComponent(cookie);
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(config.API_BASE_URL.replace(/\/$/, "") + path, {
    method,
    headers,
    credentials: "include",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(
      data?.message ||
        data?.detail ||
        `Request failed (${response.status}). Please check your membership and try again.`,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export function patreonLoginUrl() {
  const url = new URL(loadRuntimeConfig().API_BASE_URL + "/auth/redirect");
  url.searchParams.set("return_to", window.location.href);
  return url.href;
}
