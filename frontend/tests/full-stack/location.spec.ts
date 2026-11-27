import { expect, login, site, test } from "./fixtures";

for (const member of [false, true]) {
  test(`${member ? "member" : "visitor"} address search opens the correct channel filters`, async ({
    page,
  }) => {
    if (member) await login(page);
    await page.goto("/");
    const input = page.getByRole("combobox", {
      name: "Chicago street address",
      exact: true,
    });
    await input.fill("3510 South Michigan Avenue");
    await expect(page.getByRole("option")).toBeVisible();
    await input.press("ArrowDown");
    await input.press("Enter");
    await expect(input).toHaveAttribute("aria-expanded", "false");
    await page
      .getByRole("button", {
        name: member ? "Search transcripts" : "See sample transcripts",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/transcripts\/search\?/);
    const params = new URL(page.url()).searchParams;
    const index = member ? "calls_2026_10" : "calls_demo";
    expect(params.get(`${index}[refinementList][talkgroup_tag][0]`)).toBe(
      "Chi PD Zone 7",
    );
    expect(params.get(`${index}[refinementList][talkgroup_tag][1]`)).toBe(
      "CFD Fire Englewd",
    );
    expect(params.get(`${index}[refinementList][talkgroup_tag][2]`)).toBe(
      "CFD EMS Englwd",
    );
    expect([...params.values()]).not.toContain("chi_cfd");
    await expect(page.locator("[data-transcript-search]")).toHaveAttribute(
      "data-demo",
      String(!member),
    );
  });
}

test("outside-Chicago lookup shows an error and lets the visitor retry", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.getByRole("combobox", {
    name: "Chicago street address",
    exact: true,
  });
  await input.fill("Evanston");
  const button = page.getByRole("button", {
    name: "See sample transcripts",
    exact: true,
  });
  await button.click();
  await expect(page.locator("#home-location-status")).toHaveText(
    "This search currently supports Chicago addresses only.",
  );
  await expect(button).toBeEnabled();
  await input.fill("3510 South Michigan Avenue");
  await button.click();
  await expect(page).toHaveURL(/\/transcripts\/search\?/);
});

test("failed geocoding stays on the homepage with a retryable error", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Chicago street address", exact: true })
    .fill("unavailable address");
  const button = page.getByRole("button", {
    name: "See sample transcripts",
    exact: true,
  });
  await button.click();
  await expect(page.locator("#home-location-status")).toContainText(
    "temporarily unavailable",
  );
  await expect(button).toBeEnabled();
  await expect(page).toHaveURL(`${site}/`);
});

test("map lookup resolves real Chicago boundaries and archive channel", async ({
  page,
}) => {
  await page.goto("/map");
  await expect(page.locator(".leaflet-control-layers").first()).toBeVisible();
  const form = page.locator("#address-search form");
  await form
    .getByRole("textbox", {
      name: "Address, intersection, place to search",
      exact: true,
    })
    .fill("3510 South Michigan Avenue");
  await form.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator("#address-search")).toContainText("Bronzeville");
  await expect(page.locator("#address-search")).toContainText(
    "District 2, Beat 0213",
  );
  await expect(page.locator("#archive-feed")).toHaveValue("zone7");
  await page.getByRole("tab", { name: /^Traffic/ }).click();
  await expect(page.locator("#waze-map")).toHaveAttribute("src", /waze.com/);
  await page.getByRole("tab", { name: /^Crime/ }).click();
  await expect(page.locator("#clear-map")).toHaveAttribute("src", /./);
});

test("map lookup errors are dismissible", async ({ page }) => {
  await page.goto("/map");
  await expect(page.locator(".leaflet-control-layers").first()).toBeVisible();
  const form = page.locator("#address-search form");
  await form
    .getByRole("textbox", {
      name: "Address, intersection, place to search",
      exact: true,
    })
    .fill("nonexistent address");
  await form.getByRole("button", { name: "Search", exact: true }).click();
  const alert = page.locator("#address-search [role=alert]");
  await expect(alert).toContainText("could not be found");
  await alert.getByRole("button", { name: "Close", exact: true }).click();
  await expect(alert).toHaveCount(0);
});

test("device location resolves Chicago boundaries", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"], { origin: site });
  await context.setGeolocation({
    latitude: 41.83055,
    longitude: -87.62412,
    accuracy: 10,
  });
  await page.goto("/map");
  await expect(page.locator(".leaflet-control-layers").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Use my location", exact: true })
    .click();
  await expect(page.locator("#address-search")).toContainText(
    "District 2, Beat 0213",
  );
  await expect(page.locator("#address-search")).toContainText(
    "From device location",
  );
});
