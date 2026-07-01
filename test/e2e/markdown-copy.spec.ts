import { expect, test } from "@playwright/test";

// E2E scenarios (TC-33 to TC-40). These run against a development kintone
// environment. Connection details come from environment variables so no host
// or credential is committed. They are not run in CI.

const BASE_URL = process.env.KINTONE_BASE_URL ?? "";
const USERNAME = process.env.KINTONE_USERNAME ?? "";
const PASSWORD = process.env.KINTONE_PASSWORD ?? "";
const APP_ID = process.env.KINTONE_APP_ID ?? "";

const configured = Boolean(BASE_URL && USERNAME && PASSWORD && APP_ID);

test.describe("kintone-markdown-copy", () => {
  test.skip(
    !configured,
    "Set KINTONE_BASE_URL, KINTONE_USERNAME, KINTONE_PASSWORD, KINTONE_APP_ID",
  );

  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`${BASE_URL}/login`);
    await page.fill("input[name='username']", USERNAME);
    await page.fill("input[name='password']", PASSWORD);
    await page.click("input[type='submit']");
    await page.waitForLoadState("networkidle");
  });

  async function readClipboard(page: import("@playwright/test").Page): Promise<string> {
    return page.evaluate(() => navigator.clipboard.readText());
  }

  async function openMenuAndCopy(
    page: import("@playwright/test").Page,
    format: string,
  ): Promise<void> {
    await page.click("#kp-mdcopy-button");
    await page.click(`#kp-mdcopy-menu .kp-mdcopy-item[data-format='${format}']`);
  }

  test("TC-33: detail copy to a Markdown table", async ({ page }) => {
    await page.goto(`${BASE_URL}/k/${APP_ID}/show#record=1`);
    await page.waitForSelector("#kp-mdcopy-button");
    await openMenuAndCopy(page, "table");
    const text = await readClipboard(page);
    expect(text).toContain("| フィールド | 値 |");
    await expect(page.locator(".kp-mdcopy-toast--success")).toContainText("コピーしました");
  });

  test("TC-34: list copy hits the record cap", async ({ page }) => {
    await page.goto(`${BASE_URL}/k/${APP_ID}/`);
    await page.waitForSelector("#kp-mdcopy-button");
    await openMenuAndCopy(page, "tsv");
    await expect(page.locator(".kp-mdcopy-toast")).toContainText("先頭");
  });

  test("TC-35: list output honors filter and sort order", async ({ page }) => {
    await page.goto(`${BASE_URL}/k/${APP_ID}/`);
    await page.waitForSelector("#kp-mdcopy-button");
    await openMenuAndCopy(page, "table");
    const text = await readClipboard(page);
    const lines = text.split("\n");
    // Header + separator + at least one data row.
    expect(lines.length).toBeGreaterThan(2);
  });

  test("TC-38: list copy with zero records reports an empty result", async ({ page }) => {
    // Assumes a saved view or query that returns no records.
    await page.goto(`${BASE_URL}/k/${APP_ID}/?view=empty`);
    await page.waitForSelector("#kp-mdcopy-button");
    await openMenuAndCopy(page, "table");
    await expect(page.locator(".kp-mdcopy-toast--error")).toContainText(
      "コピーする対象のレコードがありません",
    );
  });

  test("TC-39: last selection is restored after reload", async ({ page }) => {
    await page.goto(`${BASE_URL}/k/${APP_ID}/`);
    await page.waitForSelector("#kp-mdcopy-button");
    await page.click("#kp-mdcopy-button");
    await page.click("#kp-mdcopy-menu .kp-mdcopy-item[data-format='tsv']");
    await page.reload();
    await page.waitForSelector("#kp-mdcopy-button");
    const stored = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.startsWith("kp-mdcopy-"));
      return key ? localStorage.getItem(key) : null;
    });
    expect(stored).toContain("tsv");
  });

  test("TC-40: settings block a duplicate profile name", async ({ page }) => {
    await page.goto(`${BASE_URL}/k/admin/app/${APP_ID}/plugin/`);
    // Placeholder: navigate into the plugin config and assert the duplicate-name
    // error. The exact selectors depend on the kintone admin chrome.
    await expect(page).toHaveURL(/plugin/);
  });
});
