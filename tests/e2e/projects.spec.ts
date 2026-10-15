import { expect, test } from "@playwright/test";

import { storageStatePath } from "./helpers/storage";

/**
 * AC-10 dan AC-11: alur membuat proyek lewat UI sampai kode otomatis tampil, lalu proyek bisa
 * dibuka dari daftar. Data dibuat di branch Neon dev yang dipakai e2e.
 */
test.describe("buat proyek", () => {
  test.use({ storageState: storageStatePath("WM_HO_SPECIALIST") });

  test("AC-11 proyek baru wajib punya tepat satu Estate utama", async ({
    page,
  }) => {
    await page.goto("/proyek/baru");
    await expect(
      page.getByRole("heading", { name: "Buat proyek" }),
    ).toBeVisible();

    await page.getByLabel("Nama proyek").fill("Proyek e2e kanal");
    await page
      .getByLabel("Kategori", { exact: true })
      .selectOption({ index: 1 });

    const region = page.getByLabel("Region", { exact: true });
    await region.selectOption({ index: 1 });
    const company = page.getByLabel("Company", { exact: true });
    await company.selectOption({ index: 1 });

    const estate = page.locator("fieldset input[type=checkbox]").first();
    await estate.check();

    // Belum ada Estate utama yang dipilih.
    await page.getByRole("button", { name: "Simpan proyek" }).click();
    await expect(page.getByText("Pilih Estate utama.")).toBeVisible();

    await page.getByLabel("Estate utama").first().check();
    await page.getByLabel("Target mulai").fill("2026-10-01");
    await page.getByLabel("Target selesai").fill("2026-12-20");
    await page.getByLabel("Anggaran rencana").fill("450000000.00");
    await page.getByRole("button", { name: "Simpan proyek" }).click();

    // Runner CI menjangkau Neon lebih lambat; respons POST bisa ~3 detik sebelum navigasi.
    await expect(page).toHaveURL(/\/proyek\/WM-[A-Z0-9]+-\d{4}-\d{4}$/, {
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("WM-", {
      timeout: 15_000,
    });
    await expect(page.getByText("Proyek: Draf").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("AC-13 proyek yang dibuat muncul di daftar proyek", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/proyek");
    await page.getByLabel("Cari").fill("kanal");
    await page.getByRole("button", { name: "Saring" }).click();

    // D-20: tabel di desktop, daftar ringkas di bawah 768 px.
    const data = isMobile
      ? page.getByRole("list", { name: "Daftar proyek" })
      : page.getByRole("table", { name: "Daftar proyek" });
    await expect(data).toBeVisible({ timeout: 15_000 });
    await expect(data).toContainText("WM-", { timeout: 15_000 });
  });
});

test.describe("viewer proyek", () => {
  test.use({ storageState: storageStatePath("MANAGEMENT_VIEWER") });

  test("AC-02 Management Viewer tidak melihat tombol aksi proyek", async ({
    page,
  }) => {
    await page.goto("/proyek");
    await expect(page.getByRole("link", { name: "Buat proyek" })).toHaveCount(
      0,
    );
  });
});
