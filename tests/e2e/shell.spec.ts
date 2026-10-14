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

  test("tidak ada pelanggaran axe serius di halaman aplikasi", async ({
    page,
  }) => {
    // Sembilan halaman dipindai berurutan; default 30 detik habis saat worker paralel.
    // Assertion-nya tetap sama, hanya anggaran waktunya yang realistis.
    test.setTimeout(180_000);

    const paths = [
      "/dashboard",
      "/proyek",
      "/proyek/WM-THIP-2026-0001",
      "/portofolio",
      "/laporan",
      "/master",
      "/master/vendors",
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

  test("D-30: header tiga baris dengan grup Plan dan Timeline", async ({
    page,
  }) => {
    await page.goto("/portofolio");
    const gantt = page.getByRole("table", { name: "Gantt portofolio" });
    const head = gantt.locator("thead");
    await expect(head.locator("tr")).toHaveCount(3);

    // Baris 1: No. dan Job Item membentang tiga baris, Plan dua kolom, Timeline sisa minggu.
    // Plan/Start/End disembunyikan di 375 px sehingga tidak ada di accessibility tree,
    // jadi pakai locator biasa yang tidak bergantung pada visibilitas.
    const first = head.locator("tr").nth(0);
    await expect(first.locator("th", { hasText: "No." })).toHaveAttribute(
      "rowspan",
      "3",
    );
    await expect(first.locator("th", { hasText: "Job Item" })).toHaveAttribute(
      "rowspan",
      "3",
    );
    await expect(first.locator("th", { hasText: "Plan" })).toHaveAttribute(
      "colspan",
      "2",
    );
    await expect(first.locator("th", { hasText: "Timeline" })).toHaveAttribute(
      "colspan",
      /\d+/,
    );

    // Baris 2: Start dan End membentang dua baris, sisanya nomor minggu.
    const second = head.locator("tr").nth(1);
    await expect(second.locator("th", { hasText: "Start" })).toHaveAttribute(
      "rowspan",
      "2",
    );
    await expect(second.locator("th", { hasText: "End" })).toHaveAttribute(
      "rowspan",
      "2",
    );

    // Baris 3 hanya berisi tanggal dd/mem.
    await expect(
      head.locator("tr").nth(2).locator("th", { hasText: "03/08" }),
    ).toBeVisible();
  });

  test("D-31: kolom No. bernomor otomatis sesuai jenjang", async ({ page }) => {
    await page.goto("/portofolio");
    const gantt = page.getByRole("table", { name: "Gantt portofolio" });
    // allTextContents() tidak menunggu; pastikan tabel sudah dirender setelah session dibaca.
    await expect(gantt).toBeVisible();
    const numbers = await gantt
      .locator("tbody tr td:first-child")
      .allTextContents();
    // Proyek, Pekerjaan 1 + empat anaknya, Pekerjaan 2 + anaknya.
    expect(numbers.map((n) => n.trim())).toEqual([
      "#",
      "1",
      "a",
      "b",
      "c",
      "d",
      "2",
      "a",
    ]);
  });

  test("D-28: garis merah hanya di batas kanan minggu berjalan, legenda di bawah tabel", async ({
    page,
  }) => {
    await page.goto("/portofolio");
    const gantt = page.getByRole("table", { name: "Gantt portofolio" });
    await expect(gantt).toBeVisible();

    // D-35: garis penanda hanya di baris 2 (W1..Wn), baris 3 (tanggal), dan baris badan;
    // baris 1 (No., Job Item, Plan, Timeline) tidak ikut.
    const head = gantt.locator("thead");
    for (const index of [1, 2]) {
      await expect(
        head.locator("tr").nth(index).locator("th.border-r-\\[3px\\]"),
      ).toHaveCount(1);
    }
    await expect(
      head.locator("tr").nth(0).locator("th.border-r-\\[3px\\]"),
    ).toHaveCount(0);
    await expect(
      head.locator("tr").nth(1).getByRole("columnheader", { name: "W11" }),
    ).toHaveClass(/border-r-gantt-edge/);

    // Tidak boleh ada kelas merah di sisi lain atau dari token badge EWS.
    await expect(gantt.locator(".border-ews-red")).toHaveCount(0);
    await expect(gantt.locator(".bg-canal-soft")).toHaveCount(0);
    await expect(
      gantt.getByRole("columnheader", { name: /W11, 12\/10, minggu berjalan/ }),
    ).toHaveCount(1);

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

  test("D-32: switcher mengubah jumlah minggu dan menyembunyikan garis saat di luar rentang", async ({
    page,
  }) => {
    await page.goto("/portofolio");
    const gantt = page.getByRole("table", { name: "Gantt portofolio" });
    const weekHeaders = gantt.getByRole("columnheader", { name: /^W\d+$/ });

    await expect(weekHeaders).toHaveCount(16);

    await page.getByRole("button", { name: "26 minggu" }).click();
    await expect(weekHeaders).toHaveCount(26);
    await expect(gantt.locator(".border-r-gantt-edge").first()).toBeVisible();

    // Pada 8 minggu, minggu berjalan (W11) di luar rentang sehingga garis hilang.
    await page.getByRole("button", { name: "8 minggu" }).click();
    await expect(weekHeaders).toHaveCount(8);
    await expect(gantt.locator(".border-r-gantt-edge")).toHaveCount(0);

    await page.getByRole("button", { name: "52 minggu" }).click();
    await expect(weekHeaders).toHaveCount(52);
    await expect(gantt.locator(".border-r-gantt-edge").first()).toBeVisible();
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
