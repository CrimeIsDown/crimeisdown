import { expect, it, vi } from "vitest";

it("does not make a new request wait for another request's unfinished asset I/O", async () => {
  vi.resetModules();
  const { loadMapOverlayCollections } = await import("./overlays");
  const complete: ((value: string) => void)[] = [];
  const interrupted = loadMapOverlayCollections(() => new Promise<string>((resolve) => complete.push(resolve)));
  const json = JSON.stringify({ type: "FeatureCollection", features: [] });
  const recovered = await loadMapOverlayCollections(async () => json);
  expect(recovered.policeBeats.features).toEqual([]);
  complete.forEach((resolve) => resolve(json));
  await interrupted;
}, 1000);
