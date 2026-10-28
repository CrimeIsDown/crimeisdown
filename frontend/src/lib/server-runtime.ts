/** Server-only equivalent of the asset binding when hosted with @astrojs/node. */
export const env = {
  GEOCODING_PROVIDER: process.env.GEOCODING_PROVIDER || (import.meta.env.DEV ? "photon" : "google"),
  GOOGLE_GEOCODING_API_KEY: process.env.GOOGLE_GEOCODING_API_KEY,
  ASSETS: {
    fetch(input: Request | string): Promise<Response> {
      const path = new URL(typeof input === "string" ? input : input.url).pathname;
      // Read static assets from this server without an external network hop.
      const origin = `http://127.0.0.1:${process.env.PORT || "4321"}`;
      return fetch(origin + path, { redirect: "error" });
    },
  },
};
