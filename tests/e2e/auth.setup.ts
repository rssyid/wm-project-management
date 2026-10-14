import { expect, test as setup } from "@playwright/test";

import { E2E_ACCOUNTS, E2E_PASSWORD } from "./accounts";
import { storageStatePath } from "./helpers/storage";

/**
 * Satu login per peran, hasilnya dipakai semua test lewat storageState. Alasannya rate limit
 * Better Auth (3 percobaan sign-in per 10 detik per IP) akan menolak worker yang login
 * bersamaan di e2e dan di produksi.
 */
for (const role of [
  "SUPER_ADMIN",
  "WM_HO_SPECIALIST",
  "MANAGEMENT_VIEWER",
] as const) {
  setup(`login ${role}`, async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000);
    const { email } = E2E_ACCOUNTS[role];
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
    await page.context().storageState({ path: storageStatePath(role) });
  });
}
