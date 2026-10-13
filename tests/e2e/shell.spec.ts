import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("shell aplikasi", () => {
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

  test("tidak ada pelanggaran axe serius di dashboard dan daftar proyek", async ({
    page,
  }) => {
    for (const path of ["/dashboard", "/proyek"]) {
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
  });

  test("kolom identitas Gantt tetap terlihat saat tabel digeser di mobile", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/portofolio");
    const gantt = page.getByRole("table", { name: "Gantt portofolio" });
    await expect(gantt).toBeVisible();

    if (isMobile) {
      const before = await page
        .locator("th", { hasText: "Normalisasi kanal" })
        .first()
        .boundingBox();
      await gantt.evaluate((element) => element.scrollIntoView());
      await page.mouse.wheel(400, 0);
      const after = await page
        .locator("th", { hasText: "Normalisasi kanal" })
        .first()
        .boundingBox();
      expect(after?.x).toBe(before?.x);
    }
  });
});
