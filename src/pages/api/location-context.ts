import type { APIRoute } from "astro";

import { lookupLocationContext } from "@/lib/location/engine";

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const q = url.searchParams.get("q")?.trim() || undefined;
  const latParam = url.searchParams.get("lat");
  const lngParam = url.searchParams.get("lng");
  const lat = latParam !== null ? Number(latParam) : undefined;
  const lng = lngParam !== null ? Number(lngParam) : undefined;

  try {
    const payload = await lookupLocationContext({
      origin: request.url,
      q,
      lat,
      lng,
    });

    return new Response(JSON.stringify(payload), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=60",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to look up that location.";

    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    });
  }
};
