// Stub the external geocoder while keeping the real location API and Chicago
// boundary datasets, fetched from this process's local asset server.
const networkFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (url.hostname === "photon.komoot.io") {
    const query = (url.searchParams.get("q") || "").toLowerCase();
    if (query.includes("unavailable"))
      return Response.json({}, { status: 503 });
    if (query.includes("nonexistent")) return Response.json({ features: [] });
    const south = query.includes("7900");
    const outside = query.includes("evanston");
    const [lng, lat] = outside
      ? [-87.6877, 42.0451]
      : south
        ? [-87.5855, 41.7505]
        : [-87.62412, 41.83055];
    return Response.json({
      features: [
        {
          geometry: { type: "Point", coordinates: [lng, lat] },
          properties: {
            housenumber: outside ? undefined : south ? "7900" : "3510",
            street: south
              ? "South Stony Island Avenue"
              : "South Michigan Avenue",
            city: outside ? "Evanston" : "Chicago",
            state: "Illinois",
          },
        },
      ],
    });
  }
  if (url.origin === "http://127.0.0.1:4331")
    return networkFetch(input, options);
  throw new Error(`Unexpected external request in E2E server: ${url.origin}`);
};
