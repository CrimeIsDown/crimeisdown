import { api, expect, login, test } from "./fixtures";
import type { Page } from "@playwright/test";

async function showFilters(page: Page) {
  const filters = page.locator("#filters");
  if (!(await filters.isVisible())) {
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await expect(filters).toHaveClass(/\bshow\b/);
  }
}

test("demo search sends queries, renders results and handles empty results", async ({
  page,
}) => {
  await page.goto("/transcripts/search?calls_demo[query]=dispatch");
  await expect(page.locator(".transcript-result")).toContainText(
    "Michigan Avenue",
  );
  const input = page.locator("#transcript-query input[type=search]");
  await expect(input).toHaveValue("dispatch");
  const query = page.waitForRequest(
    (request) =>
      request.url() === `${api}/multi-search` &&
      request
        .postDataJSON()
        .queries.some((q: { q?: string }) => q.q === "Michigan"),
  );
  await input.fill("Michigan");
  await query;
  await expect(page).toHaveURL(/Michigan/);
  await input.fill("nomatch");
  await expect(page.locator("#transcript-hits")).toContainText(
    "No transmissions match these filters.",
  );
});

test("transcript playback opens the real local audio and context link", async ({
  page,
  isMobile,
}) => {
  await page.goto("/transcripts/search?calls_demo[query]=dispatch");
  const result = page.locator(".transcript-result");
  await expect(result).toHaveCount(1);
  if (isMobile) {
    await result
      .getByRole("button", { name: "More Details", exact: true })
      .click();
    await expect(result.locator("#hit-e2e-call-1-metadata-col")).toHaveClass(
      /\bshow\b/,
    );
  }
  const audio = page.waitForResponse(`${api}/e2e/recording.mp3`);
  await result.getByRole("button", { name: "Play Audio", exact: true }).click();
  expect((await audio).ok()).toBeTruthy();
  await expect(result.locator("audio")).toBeVisible();
  await expect(
    result.getByRole("link", { name: "Download Audio" }),
  ).toHaveAttribute("href", `${api}/e2e/recording.mp3`);
  await result.getByRole("link", { name: "Show call context" }).click();
  await expect(page).toHaveURL(/#hit-e2e-call-1$/);
  await expect(page.locator("#hit-e2e-call-1")).toHaveClass(/selected/);
});

test("search provider errors display recovery guidance", async ({ page }) => {
  await page.goto("/transcripts/search?calls_demo[query]=dispatch");
  await expect(page.locator(".transcript-result")).toBeVisible();
  await page
    .locator("#transcript-query input[type=search]")
    .fill("provider-error");
  await expect(page.locator("[data-search-status]")).toContainText(
    "Could not load transcripts.",
  );
});

test("paid members can save, reopen, and delete a search", async ({
  page,
}, info) => {
  await login(page);
  const name = `Saved ${info.project.name} search`;
  await page.goto("/transcripts/search?calls_2026_10[query]=dispatch");
  await expect(page.locator("[data-transcript-search]")).toHaveAttribute(
    "data-demo",
    "false",
  );
  await expect(page.locator(".transcript-result")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept(name));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await showFilters(page);
  const saved = page.locator("[data-saved-searches]");
  await expect(saved.getByRole("link", { name, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator(".transcript-result")).toBeVisible();
  await showFilters(page);
  await expect(saved.getByRole("link", { name, exact: true })).toBeVisible();
  await saved.getByRole("link", { name, exact: true }).click();
  await expect(
    page.locator("#transcript-query input[type=search]"),
  ).toHaveValue("dispatch");
  await showFilters(page);
  page.once("dialog", (dialog) => dialog.accept());
  await saved
    .getByRole("button", { name: `Delete ${name}`, exact: true })
    .click();
  await expect(saved.getByRole("link", { name, exact: true })).toHaveCount(0);
});

test("archive month selection retains the paid search query", async ({
  page,
}) => {
  await login(page);
  await page.goto("/transcripts/search?calls_2026_10[query]=dispatch");
  await expect(page.locator(".transcript-result")).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Archive month", { exact: true }).fill("2025-10");
  await expect(page).toHaveURL(/calls_2025_10/);
  await expect(
    page.locator("#transcript-query input[type=search]"),
  ).toHaveValue("dispatch");
});
