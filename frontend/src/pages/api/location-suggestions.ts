import type { APIRoute } from "astro";
import { env } from "@/lib/server-runtime";
import { photonSuggestions } from "@/lib/location/photon";

export const prerender = false;
export const GET: APIRoute = async ({ url }) => {
  const provider = env.GEOCODING_PROVIDER === "photon" ? "photon" : "google";
  const q = url.searchParams.get("q")?.trim() || "";
  try {
    const suggestions = provider === "photon" && q.length >= 3 && q.length <= 200
      ? await photonSuggestions(q) : [];
    return Response.json({ provider, suggestions }, {headers:{"Cache-Control":"public, max-age=60"}});
  } catch {
    return Response.json({error:"Address suggestions are unavailable. You can still enter an address and submit the form."}, {status:503});
  }
};
