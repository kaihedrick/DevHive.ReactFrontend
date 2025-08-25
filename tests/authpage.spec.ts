import { test, expect } from "@playwright/test";

test("AuthPage has stable, isolated inputs", async ({ page }) => {
  await page.goto("/"); // adjust path/route if needed

  // Login tab: exactly 2 fields
  await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.locator("form input")).toHaveCount(2);

  // Switch to Register: exactly 3 fields
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.locator("form input")).toHaveCount(3);

  // Height consistency check (no double-box overlays)
  const heights = await page.locator("form input").evaluateAll((els) =>
    els.map((e) => getComputedStyle(e).height)
  );
  expect(new Set(heights).size).toBe(1);
});
