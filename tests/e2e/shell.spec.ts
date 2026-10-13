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

  test("root diarahkan ke dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("tidak ada pelanggaran axe serius di semua halaman prototipe", async ({
    page,
  }) => {
    const paths = [
      "/dashboard",
      "/proyek",
      "/proyek/WM-THIP-2026-0001",
      "/portofolio",
      "/laporan",
      "/master",
      "/admin",
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
  });

  test("D-28: garis merah hanya di batas kanan minggu berjalan, legenda di bawah tabel", async ({
    page,
  }) => {
    await page.goto("/portofolio");
    const gantt = page.getByRole("table", { name: "Gantt portofolio" });
    await expect(gantt).toBeVisible();

    // Garis penanda hanya di tepi kanan W11 (minggu berjalan, 12 Okt 2026), setinggi tabel.
    const headerRow = gantt.locator("thead tr");
    await expect(headerRow.locator("th.border-r-\\[3px\\]")).toHaveCount(1);
    await expect(headerRow.locator("th", { hasText: "W11" })).toHaveClass(
      /border-r-ews-red/,
    );
    // Tidak boleh warna merah di sisi lain: itu memunculkan garis horizontal per baris.
    await expect(gantt.locator(".border-ews-red")).toHaveCount(0);
    // Sel kosong pada minggu berjalan tetap tanpa warna latar.
    await expect(gantt.locator(".bg-canal-soft")).toHaveCount(0);
    await expect(headerRow.locator("th", { hasText: "W11" })).toContainText(
      "minggu berjalan",
    );

    // Legenda berada setelah tabel, bukan sebelum.
    const legend = page.getByRole("list", { name: "Legenda Gantt" });
    await expect(legend).toBeVisible();
    const legendBox = await legend.boundingBox();
    const tableBox = await gantt.boundingBox();
    expect(legendBox?.y).toBeGreaterThan(tableBox?.y ?? 0);

    for (const label of [
      "Rencana",
      "Target revisi",
      "Revisi minggu ini",
      "Progres",
      "Selesai",
    ]) {
      await expect(legend).toContainText(label);
    }
  });

  test("D-27: sel revisi bewarna solid tanpa pola garis", async ({ page }) => {
    await page.goto("/portofolio");
    const gantt = page.getByRole("table", { name: "Gantt portofolio" });
    const striped = gantt.locator("[class*=stripes]");
    await expect(striped).toHaveCount(0);

    // Sel revisi oranye terisi penuh, tanpa padding atau sudut membulat.
    const revisi = gantt
      .locator("span.bg-gantt-rev1, span.bg-gantt-rev2")
      .first();
    await expect(revisi).toBeVisible();
    await expect(revisi).not.toHaveClass(/rounded/);
  });

  test("kolom identitas Gantt tetap terlihat saat tabel digeser di mobile", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/portofolio");
    const gantt = page.getByRole("table", { name: "Gantt portofolio" });
    await expect(gantt).toBeVisible();

    if (isMobile) {
      const identitas = page
        .locator("th", { hasText: "Normalisasi kanal" })
        .first();
      const before = await identitas.boundingBox();

      // scrollLeft langsung pada wadah, bukan page.mouse.wheel: wheel bergantung posisi
      // pointer dan jadi flaky saat test berjalan paralel.
      const scroller = page.getByRole("group", { name: "Gantt portofolio" });
      const scrolled = await scroller.evaluate((element) => {
        element.scrollLeft = 400;
        return element.scrollLeft;
      });
      expect(scrolled).toBeGreaterThan(0);

      const after = await identitas.boundingBox();
      expect(after?.x).toBe(before?.x);
    }
  });
});
