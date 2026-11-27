import { expect, test } from "./fixtures";

test("radio ID lookup handles empty, known, and unknown IDs", async ({
  page,
}) => {
  await page.goto("/reference/radio-ids");
  const lookup = page.locator("#radio-search");
  await lookup.getByRole("button", { name: "Search", exact: true }).click();
  await expect(lookup).toContainText("Radio ID must not be empty");
  await lookup.getByLabel("Radio ID", { exact: true }).fill("1");
  await lookup.getByRole("button", { name: "Search", exact: true }).click();
  await expect(lookup.locator("#agency")).toHaveText("CPD");
  await expect(lookup.locator("#level4")).toHaveText("Mayor");
  await lookup.getByLabel("Radio ID", { exact: true }).fill("unmatched-e2e-id");
  await lookup.getByRole("button", { name: "Search", exact: true }).click();
  await expect(lookup.locator("#agency")).toHaveText("N/A");
  await expect(lookup.locator("#level4")).toHaveText("N/A");
});

test("UCR lookup normalizes codes and clears stale results on no match", async ({
  page,
}) => {
  await page.goto("/reference/ucr-codes");
  const lookup = page.locator("#ucr-search");
  await lookup.getByRole("button", { name: "Search", exact: true }).click();
  await expect(lookup).toContainText("Code must not be empty");
  await lookup
    .getByLabel("UCR (Uniform Crime Reporting) Code", { exact: true })
    .fill("01-10");
  await lookup.getByRole("button", { name: "Search", exact: true }).click();
  await expect(lookup.locator("#primary_desc")).toHaveText("Homicide");
  await expect(lookup.locator("#secondary_desc")).toHaveText(
    "First Degree Murder",
  );
  await lookup
    .getByLabel("UCR (Uniform Crime Reporting) Code", { exact: true })
    .fill("unmatched-e2e-code");
  await lookup.getByRole("button", { name: "Search", exact: true }).click();
  await expect(lookup.locator("#primary_desc")).toHaveText("Not Found");
});

test("scanner utility accordions open and notepad clears on reload", async ({
  page,
}) => {
  await page.goto("/audio");
  // The client-only scanner inserts its feed list above these accordions.
  // Wait for that content before scrolling/clicking on a narrow viewport.
  await expect(
    page.locator("#streamlist .scanner-feed-row").first(),
  ).toBeVisible();
  await expect(page.locator("main astro-island[ssr]")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Radio ID Search", exact: true })
    .click();
  await expect(page.locator("#collapseRIDSearch")).toHaveClass(/\bshow\b/);
  await expect(page.locator("#radio-search")).toBeVisible();
  await page
    .getByRole("button", { name: "UCR Code Search", exact: true })
    .click();
  await expect(page.locator("#collapseUCRSearch")).toHaveClass(/\bshow\b/);
  await expect(page.locator("#ucr-search")).toBeVisible();
  await page.getByRole("button", { name: "Notepad", exact: true }).click();
  await expect(page.locator("#collapseNotepad")).toHaveClass(/\bshow\b/);
  const notes = page.getByRole("textbox", {
    name: "Scanner notepad",
    exact: true,
  });
  await notes.fill("Zone 7 dispatch notes");
  await expect(notes).toHaveText("Zone 7 dispatch notes");
  await page.reload();
  await page.getByRole("button", { name: "Notepad", exact: true }).click();
  await expect(notes).toBeEmpty();
});
