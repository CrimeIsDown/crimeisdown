import { expect, test } from "@playwright/test";

test("homepage keeps all Ember tools", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Make sense of Chicago’s scanner traffic." })).toBeVisible();
  const tools = page.getByRole("navigation", { name: "Scanner tools" });
  for (const [name, href] of [
    ["Chicago Map", "/map"],
    ["Scanner Audio", "/audio"],
    ["Scanner Transcripts", "/transcripts/search"],
    ["Scanner Guide", "/guide"],
  ]) {
    await expect(tools.getByRole("link", { name: new RegExp(name) })).toHaveAttribute("href", href);
  }
});

test("shared navigation includes supported routes", async ({ page }) => {
  await page.goto("/map");

  await expect(page.getByRole("navigation").getByRole("link", { name: "Chicago Map" })).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Scanner Audio" })).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Scanner Guide" })).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Transcript Search", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Transcript Map", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Police Directive Changes", exact: true })).toHaveCount(0);
});

test("header uses session-aware account controls when the API returns a user", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("API_BASE_URL", "https://api.local.test");
  });
  await page.route("https://api.local.test/api/user", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "http://127.0.0.1:4321",
        "access-control-allow-credentials": "true",
      },
      body: JSON.stringify({
        name: "Test User",
        patreon_tier: { name: "Supporter" },
      }),
    });
  });

  await page.goto("/");

  await expect(page.getByRole("button", { name: "Supporter Test User" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in with Patreon" })).toHaveCount(0);
});

test("map route includes lookup utilities and production map tabs", async ({ page }) => {
  await page.goto("/map");

  await expect(page.getByRole("button", { name: "Address Search", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Radio ID Search" })).toBeVisible();
  await expect(page.getByRole("button", { name: "UCR Code Search" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Notepad" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Incidents Map/ })).toHaveAttribute("href", "/transcripts/map");
  await expect(page.getByRole("radio", { name: "OpenStreetMap", exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Municipalities" })).toBeVisible();
});

test("guide route exposes inline lookup tools and embedded scanner guide", async ({ page }) => {
  await page.goto("/guide");

  await expect(page.locator("#radio-search")).toBeVisible();
  await expect(page.locator("#ucr-search")).toBeVisible();
  await expect(page.locator("#scanner-guide")).toBeVisible();
  await expect(page.getByRole("link", { name: "view on Google Docs" })).toBeVisible();
});

test("audio hub exposes live streams, archives, and utility accordions", async ({ page }) => {
  await page.goto("/audio");

  await expect(page.getByRole("heading", { name: "Live streaming from CrimeIsDown" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Look up scanner recording" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Radio ID Search" })).toBeVisible();
  await expect(page.getByRole("button", { name: "UCR Code Search" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Notepad" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Online Streams" })).toBeVisible();
});

test("live stream and archive routes handle valid and invalid deep links", async ({ page }) => {
  await page.goto("/audio/live/zone4?autoplay=true");
  await expect(page.getByRole("heading", { name: /Zone 4/i })).toBeVisible();
  await expect(page.locator("#openmhz-iframe")).toBeVisible();

  await page.goto("/audio/live/not-a-real-stream");
  await expect(page).toHaveURL(/\/audio$/);

  await page.goto("/audio?feed=zone4");
  await expect(page.locator("#archive-feed")).toHaveValue("zone4");

  await page.goto("/audio/archive/example.mp3?url=https://example.com/example.mp3&type=audio/mpeg");
  await expect(page.getByRole("heading", { name: "example.mp3" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Audio Player" })).toBeVisible();
});

test("legacy routes resolve cleanly", async ({ page, request }) => {
  const directivesResponse = await request.get("/directives");
  expect(directivesResponse.status()).toBe(404);

  await page.goto("/airshow");
  await expect(page.getByRole("heading", { name: "Chicago Air and Water Show radio" })).toBeVisible();
  await expect(page.locator("#icecast-audio")).toBeVisible();


  const transcriptResponse = await request.get("/transcripts/search", {
    maxRedirects: 0,
  });
  expect(transcriptResponse.status()).toBe(200);
  expect(await transcriptResponse.text()).toContain("Search Scanner Transcripts");
});
