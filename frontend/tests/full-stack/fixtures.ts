import { test as base, expect, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { installSearchProvider } from "./search-provider";

export const api = "http://127.0.0.1:8765";
export const site = "http://127.0.0.1:4331";

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await page.addInitScript((base) => {
      for (const [key, value] of Object.entries({
        API_BASE_URL: base,
        MEILISEARCH_URL: base,
        MEILISEARCH_DEMO_KEY: "e2e-demo-key",
      })) {
        if (!localStorage.getItem(key)) localStorage.setItem(key, value);
      }
    }, api);
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (
        url.origin === "https://cdn.jsdelivr.net" &&
        url.pathname.startsWith("/npm/bootstrap@5.3.8/dist/")
      ) {
        const asset = url.pathname.endsWith("bootstrap.min.css")
          ? "bootstrap/dist/css/bootstrap.min.css"
          : url.pathname.endsWith("bootstrap.bundle.min.js")
            ? "bootstrap/dist/js/bootstrap.bundle.min.js"
            : undefined;
        if (asset)
          return route.fulfill({
            path: fileURLToPath(import.meta.resolve(asset)),
            contentType: asset.endsWith(".css")
              ? "text/css"
              : "application/javascript",
          });
      }
      return [site, api].includes(url.origin)
        ? route.continue()
        : route.abort();
    });
    await installSearchProvider(page);
    await use(page);
  },
});

export { expect };

export async function login(page: Page) {
  expect(
    (await page.request.get(`${api}/sanctum/csrf-cookie`)).ok(),
  ).toBeTruthy();
  const csrf = (await page.context().cookies(api)).find(
    (cookie) => cookie.name === "XSRF-TOKEN",
  );
  expect(csrf).toBeDefined();
  const response = await page.request.post(`${api}/login`, {
    headers: {
      Accept: "application/json",
      "X-XSRF-TOKEN": decodeURIComponent(csrf!.value),
    },
    form: { email: "audio@example.test", password: "audio-e2e-password" },
  });
  expect(response.ok()).toBeTruthy();
}

export async function openNavigation(page: Page, mobile: boolean) {
  if (mobile) {
    const toggle = page.getByRole("button", {
      name: "Toggle navigation",
      exact: true,
    });
    if ((await toggle.getAttribute("aria-expanded")) !== "true")
      await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
}
