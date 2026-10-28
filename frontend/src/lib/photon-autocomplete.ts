import type { PhotonLocation } from "./location/photon";

export function attachPhotonAutocomplete(input: HTMLInputElement, select: (location: PhotonLocation) => void) {
  const wrapper = input.closest<HTMLElement>(".home-location-input")!;
  const dropdown = wrapper.querySelector<HTMLElement>("[data-location-dropdown]")!;
  const list = wrapper.querySelector<HTMLUListElement>("[role=listbox]")!;
  let options: PhotonLocation[] = [];
  let active = -1;
  let timer: ReturnType<typeof setTimeout>;
  let controller: AbortController | undefined;
  let revision = 0;
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-expanded", "false");
  input.autocomplete = "off";
  function close() {
    dropdown.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  }
  function choose(index: number) {
    const location = options[index];
    if (!location) return;
    input.value = location.formattedAddress;
    select(location);
    close();
  }
  function highlight(index: number) {
    active = index;
    [...list.children].forEach((item, i) => item.setAttribute("aria-selected", String(i === active)));
    const item = list.children[active];
    if (item) {
      input.setAttribute("aria-activedescendant", item.id);
      item.scrollIntoView({block:"nearest"});
    }
  }
  async function search(query: string, requestRevision: number) {
    controller = new AbortController();
    try {
      const response = await fetch(`/api/location-suggestions?q=${encodeURIComponent(query)}`, {signal:controller.signal});
      if (!response.ok) return;
      const payload = await response.json() as {suggestions:PhotonLocation[]};
      if (requestRevision !== revision || document.activeElement !== input) return;
      options = payload.suggestions;
      list.replaceChildren();
      options.forEach((location, index) => {
        const item = document.createElement("li");
        item.id = `${list.id}-${index}`;
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", "false");
        item.textContent = location.formattedAddress;
        item.addEventListener("pointerdown", event => event.preventDefault());
        item.addEventListener("click", () => choose(index));
        list.append(item);
      });
      dropdown.hidden = !options.length;
      input.setAttribute("aria-expanded", String(Boolean(options.length)));
    } catch {
      // A typed address can still be submitted if suggestions fail.
    }
  }
  function onInput() {
    revision++;
    clearTimeout(timer);
    controller?.abort();
    close();
    const query = input.value.trim();
    if (query.length < 3) return;
    const requestRevision = revision;
    timer = setTimeout(() => void search(query, requestRevision), 500);
  }
  function onKey(event: KeyboardEvent) {
    if (dropdown.hidden) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const down = event.key === "ArrowDown";
      highlight(active < 0 ? (down ? 0 : options.length - 1) : (active + (down ? 1 : -1) + options.length) % options.length);
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }
  function outside(event: PointerEvent) {
    if (!wrapper.contains(event.target as Node)) close();
  }
  input.addEventListener("input", onInput);
  input.addEventListener("keydown", onKey);
  input.addEventListener("blur", close);
  document.addEventListener("pointerdown", outside);
  return () => {
    revision++;
    clearTimeout(timer);
    controller?.abort();
    input.removeEventListener("input", onInput);
    input.removeEventListener("keydown", onKey);
    input.removeEventListener("blur", close);
    document.removeEventListener("pointerdown", outside);
  };
}
