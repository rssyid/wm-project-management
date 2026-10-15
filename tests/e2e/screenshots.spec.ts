import { test } from "@playwright/test";

import { storageStatePath } from "./helpers/storage";

// Rule 35 §8: screenshot halaman utama di 1440 px dan 375 px untuk tinjauan manusia.
// Output goes to test-results/ (gitignored); copy the ones worth keeping into docs later.
const PAGES = [
  { name: "dashboard", url: "/dashboard" },
  { name: "proyek", url: "/proyek" },
  { name: "proyek-baru", url: "/proyek/baru" },
  { name: "portofolio", url: "/portofolio" },
  { name: "master", url: "/master" },
  { name: "matriks-approval", url: "/admin/matriks-approval" },
];

test.describe("screenshot tinjauan manusia", () => {
  test.use({ storageState: storageStatePath("SUPER_ADMIN") });

  test("capture screenshot halaman aplikasi", async ({ page }, testInfo) => {
    for (const target of PAGES) {
      await page.goto(target.url);
      await page.waitForLoadState("networkidle");
      const label = testInfo.project.name === "mobile" ? "375" : "1440";
      await page.screenshot({
        path: `test-results/screenshots/${target.name}-${label}.png`,
        fullPage: true,
      });
    }
  });
});
