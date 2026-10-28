import { homeSearchContext, sirensPrefillUrl } from "./home-search-context";
import { loadRuntimeConfig } from "./runtime-config";
import type { LocationContextResult } from "./location/types";
import { attachPhotonAutocomplete } from "./photon-autocomplete";
import { locationTranscriptSearch } from "./location-transcripts";

type Autocomplete = {
  addListener(event: string, callback: () => void): { remove(): void };
  getPlace(): { geometry?: { location?: { lat(): number; lng(): number } } };
};

export function mountHomeTranscriptSearch() {
  const form = document.querySelector<HTMLFormElement>("[data-home-location-search]");
  if (!form) return;
  const input = form.querySelector<HTMLInputElement>("input")!;
  const button = form.querySelector<HTMLButtonElement>("button")!;
  const status = form.querySelector<HTMLParagraphElement>("[role=status]")!;
  const sirensLink = form.querySelector<HTMLAnchorElement>("[data-sirens-link]")!;
  const sirensDestination = sirensLink.href;
  const config = loadRuntimeConfig();
  let disposed = false;
  let context = homeSearchContext(null);
  function updateSirensLink() {
    sirensLink.href = sirensPrefillUrl(input.value, sirensDestination);
  }
  sirensLink.addEventListener("click", updateSirensLink);
  const headers: Record<string, string> = {Accept:"application/json"};
  if (config.API_AUTH_TOKEN) headers.Authorization = "Bearer " + config.API_AUTH_TOKEN;
  void fetch(config.API_BASE_URL.replace(/\/$/, "") + "/api/user", {credentials:"include",headers,signal:AbortSignal.timeout(5000)})
    .then(response => response.ok ? response.json() : null)
    .then(account => {
      if (disposed) return;
      context = homeSearchContext(account);
      document.querySelector<HTMLElement>("[data-home-search-heading]")!.textContent = context.heading;
      form.querySelector<HTMLElement>("[data-home-search-label]")!.textContent = context.button;
      form.querySelector<HTMLElement>("[data-home-search-help]")!.textContent = context.help;
      form.querySelector<HTMLElement>("[data-home-search-limits]")!.textContent = context.limits;
    }).catch(() => {});
  let selected: { lat: number; lng: number } | undefined;
  let autocomplete: Autocomplete | undefined;
  let listener: { remove(): void } | undefined;
  let pending = false;
  let attempts = 0;
  let cleanupSuggestions = () => {};
  let timer: ReturnType<typeof setInterval> | undefined;
  function initializeGoogle() {
    timer = setInterval(() => {
      const places = (window as unknown as {
        google?: { maps?: { places?: { Autocomplete?: new (input: HTMLInputElement, options: unknown) => Autocomplete } } };
      }).google?.maps?.places;
      if (++attempts >= 60) clearInterval(timer);
      if (!places?.Autocomplete) return;
      clearInterval(timer);
      autocomplete = new places.Autocomplete(input, {
        bounds: { north: 42.03, south: 41.64, east: -87.52, west: -87.95 },
        strictBounds: true,
        componentRestrictions: { country: "us" },
        fields: ["geometry"],
        types: ["address"],
      });
      listener = autocomplete.addListener("place_changed", () => {
        const location = autocomplete?.getPlace().geometry?.location;
        selected = location ? { lat: location.lat(), lng: location.lng() } : undefined;
        updateSirensLink();
      });
    }, 250);
  }
  void fetch("/api/location-suggestions")
    .then(response => response.ok ? response.json() : null)
    .then(config => {
      if (disposed) return;
      if (config?.provider === "photon") {
        cleanupSuggestions = attachPhotonAutocomplete(input, location => {
          selected = {lat:location.lat,lng:location.lng};
          updateSirensLink();
        });
      } else initializeGoogle();
    })
    .catch(() => { if (!disposed) initializeGoogle(); });
  input.addEventListener("input", () => {
    selected = undefined;
    updateSirensLink();
    status.hidden = true;
  });
  // Let Enter choose an autocomplete suggestion before the form submits.
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && document.querySelector('.pac-item-selected')) {
      event.preventDefault();
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (pending) return;
    const address = input.value.trim();
    if (!address) {
      input.focus();
      return;
    }
    const searchContext = context;
    pending = true;
    button.disabled = true;
    form.setAttribute("aria-busy", "true");
    status.hidden = false;
    status.className = "";
    status.textContent = "Finding your police zone and fire/EMS channels…";
    try {
      const url = new URL("/api/location-context", window.location.origin);
      if (selected) {
        url.searchParams.set("lat", String(selected.lat));
        url.searchParams.set("lng", String(selected.lng));
      } else {
        url.searchParams.set("q", address);
      }
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not look up that address. Please try again.");
      const result = locationTranscriptSearch(payload as LocationContextResult, searchContext.index);
      status.textContent = `Opening ${searchContext.index === "calls_demo" ? "sample " : ""}transcripts for ${result.label}…`;
      window.location.assign(result.href);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Could not look up that address. Please try again.";
      status.className = "text-danger";
      pending = false;
      button.disabled = false;
      form.removeAttribute("aria-busy");
    }
  });
  window.addEventListener("pageshow", () => {
    pending = false;
    button.disabled = false;
    form.removeAttribute("aria-busy");
    status.hidden = true;
  });
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    disposed = true;
    cleanupSuggestions();
    clearInterval(timer);
    listener?.remove();
  }, { once: true });
}
