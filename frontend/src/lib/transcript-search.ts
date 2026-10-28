import "flatpickr/dist/flatpickr.css";
import fireStations from "../../public/data/city_data/fire_stations.json";
import instantsearch, { type UiState } from "instantsearch.js";
import { instantMeiliSearch } from "@meilisearch/instant-meilisearch";
import { history } from "instantsearch.js/es/lib/routers";
import { connectRange, connectGeoSearch } from "instantsearch.js/es/connectors";
import {
  clearRefinements,
  currentRefinements,
  hierarchicalMenu,
  hits,
  hitsPerPage,
  geoSearch,
  pagination,
  refinementList,
  searchBox,
  sortBy,
  stats,
} from "instantsearch.js/es/widgets";
import { loadRuntimeConfig } from "./runtime-config";

const systems: Record<string, string> = {
  chi_cpd: "Chicago Police Department",
  chi_cfd: "Chicago Fire Department (conventional P25)",
  chi_oemc: "Chicago OEMC (trunked P25)",
  sc21102: "STARCOM21",
  chisuburbs: "Chicago Suburbs",
  willco_p25: "Will County (P25)",
};
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const safeAudio = (value: unknown) => {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) ? escape(url.href) : "";
  } catch {
    return "";
  }
};

export function transcriptIndex(search: string, fallback: string): string {
  for (const key of new URLSearchParams(search).keys()) {
    const match = /^(calls_\d{4}_\d{2}|calls_demo)\[/.exec(key);
    if (match) return match[1];
  }
  return fallback;
}

export function transcriptText(hit: Record<string, unknown>): string {
  if (typeof hit.transcript_plaintext === "string")
    return hit.transcript_plaintext;
  try {
    const segments =
      typeof hit.raw_transcript === "string"
        ? JSON.parse(hit.raw_transcript)
        : hit.raw_transcript;
    if (Array.isArray(segments))
      return segments
        .map((segment) => (Array.isArray(segment) ? segment[1] : ""))
        .join("\n");
  } catch {
    /* A malformed source record must not break the result list. */
  }
  return "Transcript unavailable.";
}

export function switchTranscriptIndex(
  url: URL,
  previous: string,
  next: string,
  range?: string,
): URL {
  const result = new URL(url);
  const params = new URLSearchParams();
  for (const [key, value] of result.searchParams) {
    if (key.startsWith(previous + "[")) {
      if (key.includes("[range][start_time]") || key.includes("[page]"))
        continue;
      params.append(
        next + key.slice(previous.length),
        key.endsWith("[sortBy]")
          ? value.replace(previous + ":", next + ":")
          : value,
      );
    } else params.append(key, value);
  }
  if (range) params.set(next + "[range][start_time]", range);
  if (![...params.keys()].some((key) => key.startsWith(next + "["))) {
    params.set(next + "[sortBy]", next + ":start_time:desc");
  }
  result.search = params.toString();
  return result;
}

export async function mountTranscriptSearch() {
  const root = document.querySelector<HTMLElement>("[data-transcript-search]");
  if (!root) return;
  const onMap = root.dataset.transcriptMap === "true";
  const config = loadRuntimeConfig();
  const api = config.API_BASE_URL.replace(/\/$/, "");
  const notice = root.querySelector<HTMLElement>("[data-search-notice]")!;
  const status = root.querySelector<HTMLElement>("[data-search-status]")!;
  const login = root.querySelector<HTMLAnchorElement>("[data-search-login]")!;
  const loginUrl = new URL(api + "/auth/redirect");
  loginUrl.searchParams.set("return_to", window.location.href);
  login.href = loginUrl.href;
  login.addEventListener("click", () => {
    loginUrl.searchParams.set("return_to", window.location.href);
    login.href = loginUrl.href;
  });
  const headers: Record<string, string> = { Accept: "application/json" };
  if (config.API_AUTH_TOKEN)
    headers.Authorization = "Bearer " + config.API_AUTH_TOKEN;
  const request = (path: string, options: RequestInit = {}) =>
    fetch(api + path, {
      ...options,
      credentials: "include",
      headers: { ...headers, ...options.headers },
    });
  const explicitDemo = transcriptIndex(window.location.search, "") === "calls_demo";
  let key = explicitDemo ? config.MEILISEARCH_DEMO_KEY : config.MEILISEARCH_KEY;
  let paid = false;
  try {
    const user = explicitDemo ? null : await request("/api/user");
    const account = user?.ok ? await user.json() : null;
    const features = account?.patreon_tier?.features || {};
    root.querySelector<HTMLElement>("[data-search-notifications]")!.hidden =
      !features.transcript_notifications;
    if (!explicitDemo && !key && account) {
      const response = await request("/api/search-key");
      if (response.ok) {
        key = (await response.json()).meilisearch;
        paid = true;
      } else if (response.status !== 403)
        throw new Error("Could not load your search key. Please try again.");
    } else if (key && !explicitDemo) paid = true;
    const mapAccess = !onMap || features.transcript_geosearch;
    if (!mapAccess) {
      paid = false;
      root.querySelector<HTMLElement>("[data-map-membership]")!.hidden =
        !account;
    }
    if (!paid) {
      key = config.MEILISEARCH_DEMO_KEY;
      notice.hidden = false;
      status.textContent = explicitDemo
        ? "Try searching these channels using historical sample recordings. Unlock current scanner transcripts with a qualifying Patreon membership."
        : account
        ? `You are currently using a demo version with old transmissions. To search the latest scanner traffic, please upgrade your membership on Patreon to the ${onMap ? "Captain ($20/mo)" : "Sergeant ($5/mo)"} tier or above to access.`
        : "You are currently using a demo version with old transmissions. To search the latest scanner traffic, become a patron of at least $5/mo and then ";
    }
    if (!key) throw new Error("Sample transcript search is temporarily unavailable. Please try again later.");
    login.hidden = Boolean(account);
    root.querySelector<HTMLElement>("[data-search-login-suffix]")!.hidden = Boolean(account);
    root.querySelector<HTMLElement>("[data-search-become]")!.hidden = Boolean(account);
    root.dataset.demo = String(!paid);
    root
      .querySelector<HTMLElement>("[data-search-refresh]")!
      .closest<HTMLElement>(".btn-group")!.hidden = !paid;
    const month = transcriptMonth(new Date()).replace("-", "_");
    const currentIndex = config.SEARCH_INDEX || "calls_" + month;
    const requestedIndex = transcriptIndex(
      window.location.search,
      currentIndex,
    );
    const index = paid ? requestedIndex : "calls_demo";
    if (requestedIndex !== index && window.location.search) {
      window.history.replaceState(
        window.history.state,
        "",
        switchTranscriptIndex(
          new URL(window.location.href),
          requestedIndex,
          index,
        ).href,
      );
    }
    const demoOffer = root.querySelector<HTMLElement>("[data-search-demo-offer]")!;
    demoOffer.hidden = !explicitDemo;
    if (explicitDemo) {
      notice.hidden = true;
      root.querySelector<HTMLElement>("[data-save-search-button]")!.hidden = true;
    }
    const search = instantsearch({
      indexName: index,
      searchClient: instantMeiliSearch(config.MEILISEARCH_URL, key, {
        finitePagination: true,
        keepZeroFacets: true,
      }).searchClient,
      routing: {
        router: history({
          cleanUrlOnDispose: false,
          windowTitle(state) {
            const query = state[index]?.query;
            return `${query ? query + " - " : ""}Search Scanner Transcripts | CrimeIsDown.com`;
          },
          parseURL({ qsModule, location }) {
            const state = qsModule.parse(location.search.slice(1), {
              arrayLimit: 99,
            }) as unknown as UiState;
            return Object.keys(state).length
              ? state
              : {
                  [index]: {
                    sortBy: index + ":start_time:desc",
                    ...(onMap
                      ? {
                          hitsPerPage: 60,
                          geoSearch: { boundingBox: "42,-87.5,41.6,-87.9" },
                        }
                      : {}),
                    ...(paid
                      ? {
                          range: {
                            start_time:
                              Math.floor(Date.now() / 1000 - 43200) + ":",
                          },
                        }
                      : {}),
                  },
                };
          },
        }),
      },
      future: { preserveSharedStateOnUnmount: true },
    });
    search.addWidgets([
      searchBox({
        container: "#transcript-query",
        placeholder: "",
        showReset: true,
        cssClasses: { input: "form-control" },
      }),
      sortBy({
        container: "#transcript-sort",
        cssClasses: { select: "form-select" },
        items: [
          { label: "Newest First", value: index + ":start_time:desc" },
          { label: "Oldest First", value: index + ":start_time:asc" },
        ],
      }),
      hitsPerPage({
        container: "#transcript-page-size",
        cssClasses: { select: "form-select" },
        items: [
          { label: "20 per page", value: 20, default: !onMap },
          { label: "40 per page", value: 40 },
          { label: "60 per page", value: 60, default: onMap },
        ],
      }),
      stats({ container: "#transcript-stats" }),
      currentRefinements({
        container: "#transcript-current",
        transformItems(items) {
          return items.map((item) => ({
            ...item,
            label:
              (
                {
                  start_time: "Call Time",
                  short_name: "System",
                  talkgroup_group: "Department",
                  talkgroup_tag: "Talkgroup",
                } as Record<string, string>
              )[item.attribute] || item.label,
            refinements: item.refinements.map((refinement) => ({
              ...refinement,
              label:
                item.attribute === "start_time"
                  ? refinement.label.replace(
                      String(refinement.value),
                      new Date(
                        Number(refinement.value) * 1000,
                      ).toLocaleString(),
                    )
                  : item.attribute === "short_name"
                    ? systems[String(refinement.value)] || refinement.label
                    : refinement.label,
            })),
          }));
        },
      }),
      clearRefinements({
        container: "#transcript-clear",
        templates: {
          resetLabel({ hasRefinements }, { html }) {
            return html`<span>${hasRefinements ? "Clear filters" : "No filters"}</span>`;
          },
        },
      }),
      hierarchicalMenu({
        container: "#transcript-hierarchy",
        attributes: [
          "talkgroup_hierarchy.lvl0",
          "talkgroup_hierarchy.lvl1",
          "talkgroup_hierarchy.lvl2",
        ],
        limit: 60,
        transformItems: (items) => items.map((item) => ({
          ...item,
          label: systems[item.value] || item.label,
        })),
      }),
      ...[
        ["system", "short_name"],
        ["department", "talkgroup_group"],
        ["talkgroup", "talkgroup_tag"],
        ["type", "talkgroup_group_tag"],
        ["units", "units"],
        ["radios", "radios"],
      ].map(([id, attribute]) =>
        refinementList({
          container: "#transcript-" + id,
          attribute,
          operator: "or",
          searchable: true,
          showMore: true,
          showMoreLimit: 60,
          ...(id === "system"
            ? {
                transformItems: (items) =>
                  items.map((item) => ({
                    ...item,
                    label: systems[item.value] || item.label,
                    highlighted: systems[item.value] || item.highlighted,
                  })),
              }
            : {}),
        }),
      ),
      hits({
        container: "#transcript-hits",
        templates: {
          empty: "No transmissions match these filters.",
          item(hit) {
            return renderHit(
              hit,
              index,
              search.createURL.bind(search),
              Boolean(account?.is_admin),
              onMap,
              search.getUiState(),
            );
          },
        },
      }),
      pagination({ container: "#transcript-pagination" }),
    ]);
    if (onMap && !paid)
      search.addWidgets([
        await demoMapWidget(index, search.createURL.bind(search), () =>
          search.getUiState(),
        ),
      ]);
    if (onMap && paid) {
      // The same Google Maps widget and URL bounding box used by the deployed Ember UI.
      try {
        const google = await waitForGoogle();
        search.addWidgets([
          geoSearch({
            container: "#geo-search",
            googleReference: google,
            initialPosition: { lat: 41.85, lng: -87.63 },
            initialZoom: 11,
            mapOptions: { streetViewControl: true },
            enableRefineOnMapMove: false,
            builtInMarker: {
              createOptions(item) {
                return { title: String(item.geo_formatted_address || "") };
              },
              events: {
                click({ item, marker, map }) {
                  const win = new google.maps.InfoWindow({
                    content: renderHit(
                      item,
                      index,
                      search.createURL.bind(search),
                      false,
                      true,
                      search.getUiState(),
                    ),
                  });
                  win.open({ map, anchor: marker });
                },
              },
            },
          }),
        ]);
      } catch {
        root.querySelector("#geo-search")!.textContent =
          "Could not load the map. Check your connection and refresh to try again.";
      }
    }
    const flatpickr = (await import("flatpickr")).default;
    const defaultTimes = [new Date(Date.now() - 43200000), new Date()];
    const renderedTimes = ["", ""];
    let activeTimes: (number | undefined)[] = [];
    const timePickers = [
      ...root.querySelectorAll<HTMLInputElement>("[data-search-time] input"),
    ].map((input) => {
      const picker = flatpickr(input, {
        allowInput: true,
        enableTime: true,
        dateFormat: "Y-m-d\\TH:i",
        altInput: true,
        altFormat: "n/j/Y h:i K",
        onClose: () =>
          root
            .querySelector<HTMLFormElement>("[data-search-time]")!
            .requestSubmit(),
      });
      picker.altInput?.setAttribute("aria-label", input.name === "from" ? "From Time" : "To Time");
      const calendar = root.querySelector<HTMLElement>(`[data-calendar-open="${input.name}"]`);
      calendar?.addEventListener("click", () => picker.open());
      calendar?.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); picker.open(); } });
      return picker;
    });
    window.addEventListener(
      "pagehide",
      () => timePickers.forEach((picker) => picker.destroy()),
      { once: true },
    );
    let refineRange:
      | ((range: [number | undefined, number | undefined]) => void)
      | undefined;
    search.addWidgets([
      connectRange(({ refine, start }) => {
        refineRange = refine;
        activeTimes = [...start];
        for (const [position, name] of [
          [0, "from"],
          [1, "to"],
        ] as const) {
          const input = root.querySelector<HTMLInputElement>(
            `[data-search-time] input[name="${name}"]`,
          )!;
          if (document.activeElement !== input && document.activeElement !== timePickers[position].altInput) {
            const value = start[position];
            const date = Number.isFinite(value) ? new Date(Number(value) * 1000) : defaultTimes[position];
            const displayed =
              new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16);
            const picker = timePickers[position];
            if (displayed) picker.setDate(displayed, false);
            else picker.clear(false);
            renderedTimes[position] = displayed;
          }
        }
      })({ attribute: "start_time" }),
    ]);
    const monthInput = root.querySelector<HTMLInputElement>(
      "[data-search-month]",
    )!;
    monthInput.value =
      /calls_(\d{4})_(\d{2})/.exec(index)?.slice(1).join("-") ||
      transcriptMonth(new Date());
    monthInput.disabled = !paid;
    monthInput.addEventListener("change", () => {
      if (/^\d{4}-\d{2}$/.test(monthInput.value))
        window.location.assign(
          switchTranscriptIndex(
            new URL(window.location.href),
            index,
            "calls_" + monthInput.value.replace("-", "_"),
          ).href,
        );
    });
    root
      .querySelector("[data-search-time]")!
      .addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const data = new FormData(form);
        const from = String(data.get("from") || "");
        const to = String(data.get("to") || "");
        const bound = (value: string, position: number) => value === renderedTimes[position]
          ? Number.isFinite(activeTimes[position]) ? activeTimes[position] : undefined
          : value ? new Date(value).getTime() / 1000 : undefined;
        const start = bound(from, 0);
        let end = bound(to, 1);
        if (
          (start && !Number.isFinite(start)) ||
          (end && !Number.isFinite(end)) ||
          (start && end && start > end)
        ) {
          status.textContent = "Please enter a valid time range.";
          notice.hidden = false;
          return;
        }
        if (start && paid && !config.SEARCH_INDEX) {
          const nextMonth = transcriptMonth(new Date(start * 1000));
          if (end && transcriptMonth(new Date((end - 1) * 1000)) !== nextMonth) {
            const date = new Date(start * 1000);
            end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 1000 - 1;
          }
          const nextIndex = "calls_" + nextMonth.replace("-", "_");
          if (nextIndex !== index) {
            window.location.assign(
              switchTranscriptIndex(
                new URL(window.location.href),
                index,
                nextIndex,
                `${start}:${end ?? ""}`,
              ).href,
            );
            return;
          }
        }
        refineRange?.([start, end]);
      });
    root
      .querySelector("[data-search-refresh]")!
      .addEventListener("click", () => search.refresh());
    let refreshTimer: ReturnType<typeof setInterval> | undefined;
    root
      .querySelector<HTMLInputElement>("[data-search-auto-refresh]")!
      .addEventListener("change", (event) => {
        clearInterval(refreshTimer);
        if ((event.currentTarget as HTMLInputElement).checked)
          refreshTimer = setInterval(() => search.refresh(), 10000);
      });
    window.addEventListener("pagehide", () => clearInterval(refreshTimer), {
      once: true,
    });
    function resetFilters(chicago = false) {
      search.setUiState({
        [index]: {
          sortBy: index + ":start_time:desc",
          ...(paid
            ? {
                range: {
                  start_time: Math.floor(Date.now() / 1000 - 43200) + ":",
                },
              }
            : {}),
          ...(onMap
            ? {
                hitsPerPage: 60,
                geoSearch: { boundingBox: "42,-87.5,41.6,-87.9" },
              }
            : {}),
          ...(chicago
            ? {
                refinementList: {
                  short_name: ["chi_cpd", "chi_cfd", "chi_oemc"],
                },
              }
            : {}),
        },
      });
    }
    root
      .querySelector("[data-search-chicago]")!
      .addEventListener("click", () => resetFilters(true));
    root
      .querySelector("[data-search-default]")!
      .addEventListener("click", () => resetFilters());
    search.on("error", () => {
      notice.hidden = false;
      status.textContent =
        "Could not load transcripts. Refresh the page to renew your search credentials, or check your Patreon membership.";
    });
    let selectedScrolled = false;
    root.addEventListener("click", async (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-play-audio]",
      );
      if (!target) return;
      const article = target.closest<HTMLElement>(".transcript-result")!;
      const player = article.querySelector<HTMLElement>(
        ".transcript-playback",
      )!;
      player.hidden = false;
      const audio = player.querySelector<HTMLAudioElement>("audio")!;
      await audio.play().catch(() => {});
      if (
        root.querySelector<HTMLInputElement>("#waveform-toggle")!.checked &&
        !player.querySelector("canvas")
      )
        void drawWaveform(audio, player);
    });
    search.on("render", () => {
      const selected = window.location.hash.startsWith("#hit-")
        ? document.getElementById(window.location.hash.slice(1))
        : null;
      selected?.classList.add("selected");
      const contextButton = selected?.querySelector(
        '[aria-label="Show call context"]',
      );
      if (contextButton) {
        contextButton.classList.replace("btn-primary", "btn-warning");
        contextButton.innerHTML = icon("Star");
      }
      if (selected && !selectedScrolled) {
        selectedScrolled = true;
        selected.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    root.querySelector<HTMLElement>("[data-search-loading]")!.hidden = true;
    root.querySelector<HTMLElement>("[data-search-controls]")!.hidden = false;
    search.start();
    const savedList = root.querySelector<HTMLElement>("[data-saved-searches]")!;
    async function listSaved() {
      const response = await request("/api/savedSearches");
      if (!response.ok) return;
      savedList.replaceChildren();
      const payload = await response.json();
      for (const saved of payload) {
        const row = document.createElement("div");
        row.className = "list-group list-group-horizontal pb-2";
        const link = document.createElement("a");
        // Keep saved state while opening it in the current frontend, not the old host.
        const original = new URL(saved.url, window.location.origin);
        const savedIndex = transcriptIndex(original.search, index);
        const latest = switchTranscriptIndex(
          original,
          savedIndex,
          currentIndex,
        );
        link.href = window.location.pathname + latest.search + latest.hash;
        link.className = "list-group-item list-group-item-action";
        link.textContent = saved.name;
        row.append(link);
        if (saved.is_global) {
          const badge = document.createElement("span");
          badge.className = "list-group-item";
          badge.innerHTML = icon("EarthAmericas");
          badge.title = "Global search";
          row.append(badge);
        }
        if (account && saved.user_id === account.id) {
          const update = document.createElement("button");
          update.type = "button";
          update.className = "btn btn-secondary btn-sm list-group-item";
          update.innerHTML = icon("Pencil");
          update.setAttribute("aria-label", "Update " + saved.name);
          update.addEventListener("click", async () => {
            if (
              !window.confirm(
                "Are you sure you want to update this search with the current filters?",
              )
            )
              return;
            try {
              await writeSaved("PUT", "/api/savedSearches/" + saved.id, {
                name: saved.name,
                url: savedUrl(),
              });
              await listSaved();
            } catch (error) {
              status.textContent = String(error);
              notice.hidden = false;
            }
          });
          row.append(update);
          const remove = document.createElement("button");
          remove.type = "button";
          remove.innerHTML = icon("TrashAlt");
          remove.setAttribute("aria-label", "Delete " + saved.name);
          remove.className = "btn btn-danger btn-sm list-group-item";
          remove.addEventListener("click", async () => {
            if (window.confirm('Delete saved search "' + saved.name + '"?')) {
              try {
                await writeSaved("DELETE", "/api/savedSearches/" + saved.id);
                await listSaved();
              } catch (error) {
                status.textContent = String(error);
                notice.hidden = false;
              }
            }
          });
          row.append(remove);
        }
        savedList.append(row);
      }
    }
    async function writeSaved(method: string, path: string, body?: unknown) {
      const csrf = await request("/sanctum/csrf-cookie");
      if (!csrf.ok)
        throw new Error(
          "Could not initialize your session. Please sign in again.",
        );
      const cookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("XSRF-TOKEN="))
        ?.slice("XSRF-TOKEN=".length);
      const response = await request(path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { "X-XSRF-TOKEN": decodeURIComponent(cookie) } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok)
        throw new Error(
          response.status === 419
            ? "Your session could not be verified. Please sign in again."
            : "Could not save your search. Check your membership and try again.",
        );
    }
    function savedUrl() {
      const state = structuredClone(search.getUiState());
      delete state[index].range;
      delete state[index].page;
      state[index].sortBy = index + ":start_time:desc";
      return search.createURL(state);
    }
    root
      .querySelector("[data-save-search-button]")!
      .addEventListener("click", async () => {
        if (!paid || !account) {
          status.textContent =
            "Sign in with a qualifying Patreon membership to save searches.";
          notice.hidden = false;
          return;
        }
        const name = window.prompt("Enter a name for this search")?.trim();
        if (!name) return;
        try {
          await writeSaved("POST", "/api/savedSearches", {
            name,
            url: savedUrl(),
          });
          await listSaved();
        } catch (error) {
          status.textContent = String(error);
          notice.hidden = false;
        }
      });
    if (account && features.transcript_search) {
      // Older deployments stored saved searches in this browser before the API resource existed.
      const pending = JSON.parse(localStorage.getItem("savedSearches") || "[]");
      if (Array.isArray(pending) && paid) {
        while (pending.length) {
          const saved = pending[0];
          if (typeof saved?.name !== "string" || typeof saved?.url !== "string")
            break;
          await writeSaved("POST", "/api/savedSearches", {
            name: saved.name,
            url: saved.url,
          });
          pending.shift();
          if (pending.length)
            localStorage.setItem("savedSearches", JSON.stringify(pending));
          else localStorage.removeItem("savedSearches");
        }
      }
      await listSaved();
    }
  } catch (error) {
    root.querySelector<HTMLElement>("[data-search-controls]")!.hidden = false;
    root.querySelector<HTMLElement>("[data-search-loading]")!.hidden = true;
    notice.hidden = false;
    status.textContent =
      error instanceof Error
        ? error.message
        : "Could not load transcript search. Please try again.";
  }
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
const icon = (name: string) =>
  `<svg class="cid-icon" aria-hidden="true"><use href="#cid-${name}"></use></svg>`;
const highlight = (value: unknown) =>
  escape(value)
    .replaceAll("&lt;mark&gt;", "<mark>")
    .replaceAll("&lt;/mark&gt;", "</mark>")
    .replaceAll("\n", "<br>");

/** Render legacy source data without trusting markup from metadata or transcripts. */
export function renderHit(
  hit: Record<string, unknown>,
  index: string,
  createUrl: (state: UiState) => string,
  admin = false,
  map = false,
  view: UiState = {},
): string {
  const sort = view[index]?.sortBy || index + ":start_time:desc";
  const id = escape(hit.id);
  const metadata = (parseJson(hit.raw_metadata) || {}) as Record<
    string,
    unknown
  >;
  const delayed =
    hit.short_name === "chi_cpd" && Number(metadata.encrypted) === 1;
  const start = Number(hit.start_time);
  const shownTime = new Date(
    (start - (delayed ? 1800 : 0)) * 1000,
  ).toLocaleString();
  const relativeSeconds = Math.round(
    start - (delayed ? 1800 : 0) - Date.now() / 1000,
  );
  const relativeUnit =
    Math.abs(relativeSeconds) < 60
      ? "second"
      : Math.abs(relativeSeconds) < 3600
        ? "minute"
        : Math.abs(relativeSeconds) < 86400
          ? "hour"
          : Math.abs(relativeSeconds) < 86400 * 26
            ? "day"
            : Math.abs(relativeSeconds) < 86400 * 320
              ? "month"
              : "year";
  const relative = new Intl.RelativeTimeFormat(undefined, {
    numeric: "auto",
  }).format(
    Math.round(
      relativeSeconds /
        { second: 1, minute: 60, hour: 3600, day: 86400, month: 86400 * 30, year: 86400 * 365 }[relativeUnit],
    ),
    relativeUnit,
  );
  const permalink = createUrl({
    [index]: {
      refinementList: { talkgroup_tag: [String(hit.talkgroup_tag)] },
      range: { start_time: `${start}:${start}` },
    },
  });
  const context =
    createUrl({
      [index]: {
        sortBy: sort,
        hitsPerPage: 60,
        refinementList: { talkgroup_tag: [String(hit.talkgroup_tag)] },
        range: { start_time: `${start - 1200}:${start + 600}` },
      },
    }).split("#")[0] +
    "#hit-" +
    String(hit.id);
  const audio = safeAudio(hit.raw_audio_url || hit.audio_url);
  const segments = parseJson(hit.raw_transcript);
  const formatted = hit._highlightResult as
    | Record<string, { value?: unknown }>
    | undefined;
  const highlightedSegments = parseJson(
    typeof formatted?.raw_transcript?.value === "string"
      ? formatted.raw_transcript.value
          .replaceAll("&quot;", '"')
          .replaceAll("&#39;", "'")
          .replaceAll("&lt;", "<")
          .replaceAll("&gt;", ">")
          .replaceAll("&amp;", "&")
      : formatted?.raw_transcript?.value,
  );
  let transcript = "";
  if (Array.isArray(segments)) {
    transcript = segments
      .filter(Array.isArray)
      .map((segment, i) => {
        const source = segment[0] as Record<string, unknown> | null;
        const highlighted =
          Array.isArray(highlightedSegments) &&
          Array.isArray(highlightedSegments[i])
            ? highlightedSegments[i]
            : segment;
        const sourceUrl = source
          ? createUrl({
              [index]: {
                sortBy: sort,
                hitsPerPage: view[index]?.hitsPerPage || 20,
                refinementList: source.tag
                  ? { units: [String(source.tag)] }
                  : { radios: [String(source.src)] },
              },
            })
          : "";
        return `<p>${source ? `<a href="${escape(sourceUrl)}" title="Radio ID ${escape(source.src)}">${highlight((highlighted[0] || source).tag || source.src)}</a>${stationAddress(source.tag) ? ` <span title="${escape(stationAddress(source.tag))}" aria-label="${escape(stationAddress(source.tag))}">📍</span>` : ""}: ` : ""}${highlight(highlighted[1])}</p>`;
      })
      .join("");
  } else
    transcript = `<p>${highlight(formatted?.transcript_plaintext?.value || transcriptText(hit))}</p>`;
  const group = String(hit.talkgroup_group_tag || "");
  const color = /^(Law|Security)/.test(group)
    ? "primary"
    : /^(Fire|EMS)/.test(group)
      ? "danger"
      : /^(Public Works|Utilities)/.test(group)
        ? "success"
        : /^(Multi-Tac|Emergency Ops)/.test(group)
          ? "warning"
          : "secondary";
  const time = `<strong><a href="${escape(permalink)}">${icon("Link")} ${escape(shownTime)}</a></strong>${delayed ? ` - delayed until ${escape(new Date(start * 1000).toLocaleTimeString())}` : ""} <span class="fst-italic fs-7">(${escape(relative)})</span>`;
  const audioType = String(hit.audio_type || "").replace(
    "digital tdma",
    "digital",
  );
  return `<article id="hit-${id}" class="transcript-result"><div class="row"><div class="col-lg-5 collapse d-md-block order-lg-2" id="hit-${id}-metadata-col"><p class="d-none d-md-block">${time}</p><p><span class="badge text-bg-light me-1">Duration: ${escape(hit.call_length)}s</span><a href="https://openmhz.com/system/${escape(encodeURIComponent(String(hit.short_name)))}?filter-type=talkgroup&filter-code=${escape(encodeURIComponent(String(hit.talkgroup)))}&time=${start * 1000 + 1}" class="badge text-bg-secondary me-1" target="_blank" rel="noopener noreferrer">TG ${escape(hit.talkgroup)}</a><span class="badge text-bg-secondary me-1">${escape(audioType.charAt(0).toUpperCase() + audioType.slice(1))}</span>${delayed ? '<span class="badge text-bg-warning me-1" title="From an official Broadcastify.com stream of an encrypted channel">Encrypted / Delayed 30mins</span>' : ""}${admin ? `<button class="badge text-bg-light btn btn-sm btn-light" data-bs-toggle="modal" data-bs-target="#metadata-${id}">Raw Data</button>` : ""}</p><p class="fst-italic">${escape(hit.talkgroup_group)} / <strong>${escape(hit.talkgroup_description)}</strong></p>${audio ? `<div class="transcript-playback" hidden><audio class="call-audio" controls preload="none" src="${audio}"></audio><a href="${audio}" class="btn btn-sm btn-primary mt-2" target="_blank" rel="noopener noreferrer">${icon("Download")} Download Audio</a></div>` : ""}</div><div class="col"><h4 class="fs-6"><button type="button" class="btn btn-sm btn-success" data-play-audio aria-label="Play Audio" ${audio ? "" : "disabled"}>${icon("Play")}</button> <a href="${escape(context)}" class="btn btn-sm btn-primary" aria-label="Show call context" title="Show call context">${icon("Filter")}</a> <button type="button" class="btn btn-sm btn-info d-md-none" data-bs-toggle="collapse" data-bs-target="#hit-${id}-metadata-col" aria-controls="hit-${id}-metadata-col" aria-expanded="false" aria-label="More Details">${icon("CircleInfo")}</button> ${escape(hit.talkgroup_tag)} <span class="badge text-bg-${color} ms-1 me-1">${escape(group)}</span></h4>${map ? `<p><span class="badge text-bg-light fs-6">📍 ${escape(hit.geo_formatted_address)}</span></p>` : ""}<p class="text-small d-md-none">${time}</p><blockquote class="blockquote">${transcript}</blockquote></div></div>${admin ? `<div class="modal fade metadata-modal" id="metadata-${id}" tabindex="-1" aria-label="Raw Result Data"><div class="modal-dialog modal-xl"><div class="modal-content"><div class="modal-header"><h5>Raw Result Data</h5><button class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body"><pre>${escape(JSON.stringify(hit, null, 2))}</pre></div></div></div></div>` : ""}</article>`;
}

async function waitForGoogle(): Promise<
  Parameters<typeof geoSearch>[0]["googleReference"]
> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const google = (
      window as unknown as {
        google?: Parameters<typeof geoSearch>[0]["googleReference"];
      }
    ).google;
    if (google?.maps) return google;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Google Maps did not load.");
}

async function drawWaveform(audio: HTMLAudioElement, player: HTMLElement) {
  if (player.dataset.waveformMounted) return;
  player.dataset.waveformMounted = "true";
  const src = audio.currentSrc || audio.src;
  audio.pause();
  audio.className = "video-js vjs-default-skin vjs-fluid";
  try {
    const { mountWaveformPlayer } = await import("./media-player");
    const instance = await mountWaveformPlayer(audio, src, "audio/mpeg", true);
    window.addEventListener("pagehide", () => instance.dispose(), {
      once: true,
    });
  } catch {
    audio.src = src;
    audio.controls = true;
    await audio.play().catch(() => {});
  }
}

async function demoMapWidget(
  index: string,
  createUrl: (state: UiState) => string,
  getState: () => UiState,
) {
  const L = await import("leaflet");
  window.L = L.default;
  await import("leaflet.markercluster");
  let map: import("leaflet").Map;
  let markers: import("leaflet").LayerGroup;
  return connectGeoSearch(({ items }, first) => {
    if (first) {
      map = L.map("geo-search").setView([41.85, -87.63], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      const cluster = (
        window.L as typeof L.default & {
          markerClusterGroup?: (
            options: Record<string, unknown>,
          ) => import("leaflet").LayerGroup;
        }
      ).markerClusterGroup;
      markers = (
        cluster ? cluster({ disableClusteringAtZoom: 12 }) : L.layerGroup()
      ).addTo(map);
    }
    markers.clearLayers();
    const locations: import("leaflet").LatLngTuple[] = [];
    for (const item of items) {
      const coords: import("leaflet").LatLngTuple = [
        item._geoloc.lat,
        item._geoloc.lng,
      ];
      locations.push(coords);
      L.marker(coords, {
        title: String(item.geo_formatted_address || ""),
        icon: L.icon({
          iconUrl: "/img/marker-icon.png",
          shadowUrl: "/img/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        }),
      })
        .addTo(markers)
        .bindPopup(renderHit(item, index, createUrl, false, true, getState()), {
          maxWidth: 450,
        });
    }
    if (locations.length)
      map.fitBounds(L.latLngBounds(locations), { maxZoom: 15 });
  })({});
}

export function transcriptMonth(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function stationAddress(tag: unknown): string {
  if (typeof tag !== "string" || !tag) return "";
  const query = tag.replaceAll(/<\/?mark>/g, "").toUpperCase();
  const station = fireStations.find((station) => {
    const units = [
      station.engine,
      station.truck,
      station.ambo,
      station.special,
    ].flatMap((value) => String(value || "").split(/, ?/));
    if (station.squad) units.push(station.squad.split("/")[0]);
    for (const [field, prefix] of [
      [station.batt, "BC"],
      [station.fireDist, "2-2-"],
      [station.emsDist, "4-5-"],
    ])
      if (String(field).includes(" (HQ)"))
        units.push(prefix + String(field).replace(" (HQ)", ""));
    return units.includes(query);
  });
  return station ? `${station.addr} ${station.zip}` : "";
}
