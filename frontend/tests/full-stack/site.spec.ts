import { api, expect, openNavigation, site, test } from "./fixtures";

test("homepage tool cards navigate to the reference guide", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Make sense of Chicago’s scanner traffic.",
    }),
  ).toBeVisible();
  const tools = page.getByRole("navigation", { name: "Scanner tools" });
  for (const [name, href] of [
    ["Chicago Map", "/map"],
    ["Scanner Audio", "/audio"],
    ["Scanner Transcripts", "/transcripts/search"],
    ["Scanner Guide", "/guide"],
  ]) {
    await expect(
      tools.getByRole("link", { name: new RegExp(name) }),
    ).toHaveAttribute("href", href);
  }
  await tools.getByRole("link", { name: /Scanner Guide/ }).click();
  await expect(page).toHaveURL(`${site}/guide`);
  await expect(page.locator("#radio-search")).toBeVisible();
  await expect(page.locator("#scanner-guide")).toHaveAttribute(
    "src",
    /docs.google.com/,
  );
});

test("header navigation works on desktop and mobile", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await openNavigation(page, isMobile);
  await page
    .locator("header")
    .getByRole("link", { name: "Scanner Audio", exact: true })
    .click();
  await expect(page).toHaveURL(`${site}/audio`);
  await expect(
    page.getByRole("heading", { name: "Look up scanner recording" }),
  ).toBeVisible();
  await expect(page.locator('header a[href="/audio"]')).toHaveClass(/active/);
});

test("theme choice survives reload and can return to system preference", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await openNavigation(page, isMobile);
  await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-bs-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-bs-theme", "dark");
  await openNavigation(page, isMobile);
  await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
  await page.getByRole("button", { name: "Auto", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "auto");
});

test("runtime settings persist across page reloads", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("SEARCH_INDEX", { exact: true }).fill("calls_2025_01");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Settings saved.");
  await page.reload();
  await expect(page.getByLabel("SEARCH_INDEX", { exact: true })).toHaveValue(
    "calls_2025_01",
  );
});

test("legacy redirects retain query strings and missing routes return 404", async ({
  page,
  request,
}) => {
  for (const [from, to] of [
    ["/listen", "/audio"],
    ["/area", "/map"],
    ["/reference/guide", "/guide"],
  ]) {
    const response = await request.get(`${from}?source=e2e`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(`${to}?source=e2e`);
  }
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Page Not Found" }),
  ).toBeVisible();
  await page.goto("/airshow");
  await expect(
    page.getByRole("heading", { name: "Chicago Air and Water Show radio" }),
  ).toBeVisible();
  await expect(page.locator("#icecast-audio")).toBeVisible();
});

test("account login and logout update the site header", async ({
  page,
  isMobile,
}) => {
  await page.goto(`${api}/login?return_to=${encodeURIComponent(site + "/")}`);
  await page.getByLabel("Email", { exact: true }).fill("audio@example.test");
  await page.getByLabel("Password", { exact: true }).fill("audio-e2e-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(`${site}/`);
  await openNavigation(page, isMobile);
  await page.getByRole("button", { name: "Commander Audio Test User" }).click();
  await page.getByRole("link", { name: "Logout", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Log out", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(`${site}/`);
  await openNavigation(page, isMobile);
  await expect(
    page.locator("header").getByRole("link", { name: "Log in with Patreon" }),
  ).toBeVisible();
});

test("signed-out profile access leads to login", async ({ page }) => {
  await page.goto(`${api}/profile`);
  await expect(page).toHaveURL(`${api}/login`);
  await expect(
    page.getByRole("button", { name: "Log in", exact: true }),
  ).toBeVisible();
});
