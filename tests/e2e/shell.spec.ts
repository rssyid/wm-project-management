import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { storageStatePath } from "./helpers/storage";

test.describe("shell aplikasi", () => {
  test.use({ storageState: storageStatePath("WM_HO_SPECIALIST") });

  test("menu utama terbuka di desktop dan bisa dipakai dengan keyboard", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/dashboard");

    if (isMobile) {
      // Di mobile sidebar menjadi sheet dari kiri.
      await page.getByRole("button", { name: "Buka atau tutup menu" }).click();
    }

    const menuProyek = page.getByRole("link", { name: "Proyek" }).first();
    await expect(menuProyek).toBeVisible();
    await menuProyek.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/proyek$/);
  });

  test("root diarahkan ke dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("AC-13 daftar proyek punya bar filter", async ({ page }) => {
    await page.goto("/proyek");
    await expect(
      page.getByRole("heading", { name: "Proyek", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Saring" })).toBeVisible();
    await expect(page.getByLabel("Status", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Region", { exact: true })).toBeVisible();
  });

  test("tidak ada pelanggaran axe serius di halaman aplikasi", async ({
    page,
    isMobile,
  }) => {
    // Sembilan halaman dipindai berurutan; default 30 detik habis saat worker paralel.
    test.setTimeout(180_000);

    const paths = [
      "/dashboard",
      "/proyek",
      "/proyek/baru",
      "/portofolio",
      "/laporan",
      "/master",
      "/master/vendors",
      "/admin",
      "/admin/matriks-approval",
    ];
    for (const path of paths) {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const serious = results.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      );
      expect(serious, `pelanggaran di ${path}`).toEqual([]);
    }

    // Workspace proyek butuh data; dipindai hanya bila daftar proyek punya baris.
    await page.goto("/proyek");
    const firstCode = isMobile
      ? page
          .getByRole("list", { name: "Daftar proyek" })
          .getByRole("link")
          .first()
      : page
          .getByRole("table", { name: "Daftar proyek" })
          .getByRole("link")
          .first();
    if ((await firstCode.count()) > 0) {
      await firstCode.click();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const serious = results.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      );
      expect(serious, "pelanggaran di workspace proyek").toEqual([]);
    }
  });
});
