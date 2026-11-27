import { expect, test, api, login as commander } from "./fixtures";
import type { APIResponse, Page } from "@playwright/test";

async function enterTime(
  page: Page,
  id: string,
  hour: number,
  mobile: boolean,
) {
  await expect(page.locator(`#${id}`)).toHaveClass(/flatpickr-input/);
  const field = page.locator(`#${id}`).locator("..").locator("input:visible");
  await expect(field).toHaveCount(1);
  await expect(field).toBeVisible();
  await field.fill(
    mobile
      ? `2026-10-31T${String(hour).padStart(2, "0")}:00`
      : `10/31/2026 ${hour || 12}:00 AM`,
  );
  await field.press("Tab");
}

async function expectMp3(response: APIResponse) {
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("audio/mpeg");
  const bytes = await response.body();
  expect(bytes.length).toBeGreaterThan(1024);
  expect(
    bytes.subarray(0, 3).toString() === "ID3" ||
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0),
  ).toBeTruthy();
}

test("zone pop-outs open independently while CW2 stays on the scanner", async ({
  page,
  context,
}) => {
  await page.route("https://audio.crimeisdown.com/streaming/stat", (route) =>
    route.fulfill({
      contentType: "text/xml",
      body: "<rtmp><live><stream><name>citywide2</name><active/></stream></live></rtmp>",
    }),
  );
  await context.route(
    "https://www.broadcastify.com/listen/feed/popout.php?feedId=*",
    (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<title>Zone player</title>",
      }),
  );

  await page.goto("/audio");
  const cw2 = page.getByRole("checkbox", { name: "CPD Citywide 2" });
  await cw2.check();
  const cw2Player = page.getByRole("application", { name: "Audio Player" });
  await expect(cw2Player).toBeVisible();
  await cw2Player.evaluate((element) => {
    element.setAttribute("data-original-player", "");
  });

  const zone1 = page.getByRole("checkbox", { name: /CPD Zone 1 \(/ });
  const zone2 = page.getByRole("checkbox", { name: /CPD Zone 2 \(/ });
  const zone1Popup = page.waitForEvent("popup");
  await zone1.check({ timeout: 5000 });
  const firstPlayer = await zone1Popup;
  await firstPlayer.waitForURL(
    "https://www.broadcastify.com/listen/feed/popout.php?feedId=37354",
  );
  expect(await firstPlayer.evaluate(() => window.opener === null)).toBe(true);
  const zone2Popup = page.waitForEvent("popup");
  await zone2.check();
  const secondPlayer = await zone2Popup;
  await secondPlayer.waitForURL(
    "https://www.broadcastify.com/listen/feed/popout.php?feedId=37355",
  );
  await expect(zone1).toBeChecked();
  await expect(cw2Player).toHaveAttribute("data-original-player", "");

  await expect(zone1).toBeDisabled();
  await firstPlayer.close();
  await expect(zone1).not.toBeChecked();
  await expect(zone1).toBeEnabled();
  await expect(zone2).toBeChecked();
  await secondPlayer.close();
  await expect(zone2).not.toBeChecked();
  await expect(cw2).toBeChecked();
  await expect(cw2Player).toHaveAttribute("data-original-player", "");
});

test("a blocked zone pop-out leaves an ordinary Broadcastify link", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.open = () => null;
  });
  await page.goto("/audio");
  const zone = page.getByRole("checkbox", { name: /CPD Zone 1 \(/ });
  await zone.click({ timeout: 5000 });
  await expect(zone).not.toBeChecked();
  await expect(page.getByText(/browser blocked the pop-out/i)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /CPD Zone 1 .*Broadcastify in a new tab/ }),
  ).toHaveAttribute("href", "https://www.broadcastify.com/listen/feed/37354");
});

for (const hour of [0, 1]) {
  test(`Zone 7 ${hour}:00 download skips JSON metadata and serves MP3`, async ({
    page,
    context,
    isMobile,
  }) => {
    await page.goto("/audio");
    await enterTime(page, "archive-datetime", hour, isMobile);
    await page.locator("#archive-feed").selectOption("zone7");

    const requestPromise = context.waitForEvent("request", {
      predicate: (request) =>
        new URL(request.url()).pathname === "/recordings/download-audio",
    });
    const popupPromise = page.waitForEvent("popup");
    await page
      .getByRole("button", { name: "Download recording", exact: true })
      .click();
    const request = await requestPromise;
    const params = new URL(request.url()).searchParams;
    expect(params.get("feed")).toBe("zone7");
    // The browser timezone is Tokyo; these are Chicago midnight and 1 AM.
    expect(params.get("datetime")).toBe(`2026-10-31T0${hour + 5}:00:00.000Z`);
    expect(params.get("broadcastify")).toBe("1");
    const popup = await popupPromise;
    await popup.waitForURL(`${api}/recordings-temp/**`);
    await expectMp3(await popup.request.get(popup.url()));
    await popup.close();
  });
}

test("desktop calendar button opens a picker and selection reaches the field", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Mobile browsers use their native date/time control.");
  await page.goto("/audio");
  await enterTime(page, "archive-datetime", 0, false);
  await page
    .getByRole("button", { name: "Choose date and time", exact: true })
    .first()
    .click();
  const calendar = page.locator(".flatpickr-calendar.open");
  await expect(calendar).toBeVisible();
  await calendar
    .locator('.flatpickr-day[aria-label="October 30, 2026"]')
    .click();
  await expect(
    page.getByRole("textbox", {
      name: "Time of recording (in US Central time)",
      exact: true,
    }),
  ).toHaveValue("10/30/2026 12:00 AM");
});

test("Commander exports midnight through 2 AM despite JSON sidecars", async ({
  page,
  isMobile,
}) => {
  await commander(page);
  await page.goto("/audio");
  await page.locator("#range-feed").selectOption("zone7");
  await enterTime(page, "range-start-datetime", 0, isMobile);
  await enterTime(page, "range-end-datetime", 2, isMobile);
  const button = page.getByRole("button", {
    name: "Create range export",
    exact: true,
  });
  await expect(button).toBeEnabled();
  const submitted = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/audio-range-exports",
  );
  await button.click();
  expect((await submitted).postDataJSON()).toEqual({
    feed: "zone7",
    start_datetime: "2026-10-31 00:00:00",
    end_datetime: "2026-10-31 02:00:00",
    broadcastify: true,
  });
  const status = page.locator(".audio-range-export [role=status]");
  await expect(status).toContainText("succeeded");
  await expect(status).toContainText("Processed hours: 2");
  const download = status.getByRole("link", { name: "Download merged audio" });
  await expect(download).toBeVisible();
  const url = await download.getAttribute("href");
  expect(url).toMatch(/^http:\/\/127\.0\.0\.1:8765\/recordings-temp\/ranges\//);
  await expectMp3(await page.request.get(url!));
});

test("range form rejects an end before the start", async ({
  page,
  isMobile,
}) => {
  await commander(page);
  await page.goto("/audio");
  await page.locator("#range-feed").selectOption("zone7");
  await enterTime(page, "range-start-datetime", 2, isMobile);
  await enterTime(page, "range-end-datetime", 1, isMobile);
  const button = page.getByRole("button", {
    name: "Create range export",
    exact: true,
  });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.locator(".audio-range-export [role=alert]")).toHaveText(
    "End time must be after start time.",
  );
});

test("missing recordings show a useful export error", async ({
  page,
  isMobile,
}) => {
  await commander(page);
  await page.goto("/audio");
  await page.locator("#range-feed").selectOption("zone7");
  await enterTime(page, "range-start-datetime", 3, isMobile);
  await enterTime(page, "range-end-datetime", 4, isMobile);
  const button = page.getByRole("button", {
    name: "Create range export",
    exact: true,
  });
  await expect(button).toBeEnabled();
  await button.click();
  const status = page.locator(".audio-range-export [role=status]");
  await expect(status).toContainText("failed");
  await expect(status).toContainText("No recordings found in requested range.");
  await expect(
    status.getByRole("link", { name: "Download merged audio" }),
  ).toHaveCount(0);
});

test("signed-out visitors cannot create range exports", async ({ page }) => {
  await page.goto("/audio");
  const exporter = page.locator(".audio-range-export");
  await expect(exporter).toContainText("Log in to use range export.");
  await expect(
    exporter.getByRole("button", { name: "Create range export", exact: true }),
  ).toBeDisabled();
});
