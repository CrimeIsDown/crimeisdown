import { expect, site, test } from "./fixtures";

test("live audio routes expose the channel and reject unknown streams", async ({
  page,
}) => {
  await page.goto("/audio/live/zone4");
  await expect(
    page.getByRole("heading", { name: /Zone 4/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Listen on Broadcastify.com" }),
  ).toHaveAttribute("href", /broadcastify.com\/listen\/feed/);
  await expect(page.locator("#openmhz-iframe")).toHaveAttribute(
    "src",
    /openmhz.com/,
  );
  await page.goto("/audio/live/unknown-e2e-stream");
  await expect(page).toHaveURL(`${site}/audio`);
});

test("recording deep links preselect a channel and allow changing it", async ({
  page,
}) => {
  await page.goto("/audio?feed=zone7");
  await expect(page.locator("#archive-feed")).toHaveValue("zone7");
  await page.locator("#archive-feed").selectOption("zone4");
  await expect(page.locator("#archive-feed")).toHaveValue("zone4");
});

test("archive player preserves the supplied recording and media type", async ({
  page,
}) => {
  await page.goto(
    "/audio/archive/sample.mp3?url=http%3A%2F%2F127.0.0.1%3A8765%2Fe2e%2Frecording.mp3&type=audio%2Fmpeg",
  );
  await expect(
    page.getByRole("heading", { name: "recording.mp3", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Audio Player", exact: true }),
  ).toBeVisible();
});
