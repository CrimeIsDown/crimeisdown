import { expect, login, test } from "./fixtures";

test("members can create, persist, edit, and delete notification settings", async ({
  page,
}, info) => {
  await login(page);
  const topic = `e2e-${info.project.name}`;
  const name = `Alerts ${info.project.name}`;
  await page.goto("/transcripts/notifications");
  await page.getByRole("tab", { name: "Channels", exact: true }).click();
  await page.getByLabel("Service name:", { exact: true }).selectOption("ntfy");
  await page.locator("#pathInput").fill(topic);
  await page.getByRole("button", { name: "Add Channel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Edit ${topic}`, exact: true }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Subscriptions", exact: true }).click();
  const form = page.getByRole("form", {
    name: "New subscription form",
    exact: true,
  });
  await form.getByLabel("Subscription name", { exact: true }).fill(name);
  await form.locator("#keywordList").fill("traffic stop\n\nMichigan Avenue");
  await form.locator("#ignoreKeywordList").fill("disregard\n\ntraining");
  await form.getByLabel("Chi PD Zone 7", { exact: true }).check();
  await form.getByRole("checkbox", { name: new RegExp(topic) }).check();
  await form
    .getByRole("button", { name: "Add Subscription", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: `Edit ${name}`, exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
  await expect(form.locator("#keywordList")).toHaveValue(
    "traffic stop\nMichigan Avenue",
  );
  await expect(form.locator("#ignoreKeywordList")).toHaveValue(
    "disregard\ntraining",
  );
  await form.getByLabel("Enabled?", { exact: true }).uncheck();
  await form
    .getByRole("button", { name: "Update Subscription", exact: true })
    .click();
  const card = page.locator(".card").filter({
    has: page.getByRole("button", { name: `Edit ${name}`, exact: true }),
  });
  await expect(card).toContainText("Notifications are currently disabled.");
  await page.reload();
  await page.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
  await expect(form.locator("#keywordList")).toHaveValue(
    "traffic stop\nMichigan Avenue",
  );
  await expect(form.locator("#ignoreKeywordList")).toHaveValue(
    "disregard\ntraining",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: `Delete ${name}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: `Edit ${name}`, exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Channels", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: `Delete ${topic}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: `Edit ${topic}`, exact: true }),
  ).toHaveCount(0);
});

test("signed-out visitors see the notification login link", async ({
  page,
}) => {
  await page.goto("/transcripts/notifications");
  await expect(
    page
      .locator("main")
      .getByRole("link", { name: "Log in with Patreon", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Channels", exact: true }),
  ).toHaveCount(0);
});
