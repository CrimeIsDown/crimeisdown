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
