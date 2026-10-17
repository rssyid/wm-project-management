import { expect, test, type Page } from "@playwright/test";

import { storageStatePath } from "./helpers/storage";

/** Toast di kanan bawah menutupi tombol aksi di layar sempit. */
async function dismissToasts(page: Page) {
  const buttons = page.getByRole("button", { name: "Tutup notifikasi" });
  for (let index = (await buttons.count()) - 1; index >= 0; index -= 1) {
    await buttons
      .nth(index)
      .click({ timeout: 5_000 })
      .catch(() => undefined);
  }
  await expect(buttons).toHaveCount(0);
}

test.describe("master data oleh specialist", () => {
  test.use({ storageState: storageStatePath("WM_HO_SPECIALIST") });

  test("menambah dan menonaktifkan vendor", async ({ page, isMobile }) => {
    test.setTimeout(90_000);
    await page.goto("/master/vendors");
    await expect(
      isMobile
        ? page.getByRole("list", { name: "Daftar vendors" })
        : page.getByRole("table", { name: "vendors" }),
    ).toBeVisible();

    const nama = `CV Uji E2E ${Date.now()}`;
    await page.getByRole("button", { name: "Tambah vendor" }).click();
    const panel = page.getByRole("complementary", { name: "Tambah data" });
    await expect(panel).toBeVisible();
    await panel.getByLabel("Nama", { exact: true }).fill(nama);
    await panel.getByLabel("Jenis", { exact: true }).selectOption("EKSTERNAL");
    await panel.getByRole("button", { name: "Simpan" }).click();

    const toast = page.getByText("Data ditambahkan");
    await expect(toast).toBeVisible();
    // Toast menutupi tombol aksi di kanan bawah; tutup dulu sebelum mengklik baris.
    await dismissToasts(page);

    const row = isMobile
      ? page.getByRole("listitem").filter({ hasText: nama })
      : page.getByRole("row", { name: new RegExp(nama) });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: new RegExp(`Aksi ${nama}`) }).click();
    await page.getByRole("menuitem", { name: "Nonaktifkan" }).click();
    await expect(page.getByText("Data dinonaktifkan")).toBeVisible();
    await dismissToasts(page);
    await expect(row.getByText("Nonaktif")).toBeVisible({ timeout: 15_000 });
  });

  test("filter cari menyaring baris", async ({ page, isMobile }) => {
    test.setTimeout(90_000);
    const ts = Date.now();
    const unitCode = `UN${ts}`;
    const unitName = `Unit E2E ${ts}`;

    await page.goto("/master/units");

    // Baris sebelum filter dipakai sebagai pembanding: setelah filter, hanya unit uji ini yang
    // boleh tersisa (D-33).
    const list = isMobile
      ? page.getByRole("list", { name: "Daftar units" })
      : page.getByRole("table", { name: "units" });
    const rows = () => list.getByRole(isMobile ? "listitem" : "row");

    // Buat unit unik agar tidak bentrok dengan worker lain dan eliminasi race condition
    // pada data master bersama (fullyParallel, 4 worker, Neon branch dev yang sama).
    await page.getByRole("button", { name: " tambah satuan" }).click();
    const panel = page.getByRole("complementary", { name: " tambah data" });
    await expect(panel).toBeVisible();
    await panel.getByLabel("Kode", { exact: true }).fill(unitCode);
    await panel.getByLabel("Nama", { exact: true }).fill(unitName);
    await panel.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText("Data ditambahkan")).toBeVisible();

    // Server Component perlu di-refresh agar baris baru muncul; toast muncul dulu.
    await page.waitForLoadState("networkidle");
    await expect(list.getByText(unitName).first()).toBeVisible({
      timeout: 20_000,
    });
    const before = await rows().count();

    // Query master hanya memfilter kolom name (registry.ts), jadi pencarian memakai nama unit.
    await page.getByPlaceholder("Nama atau kode").fill(unitName);
    await page.getByRole("button", { name: "Saring" }).click();

    await expect(list.getByText(unitName).first()).toBeVisible();
    await expect(list.getByText(unitCode).first()).toBeVisible();
    // Filter menyaring: baris unit uji saja yang tersisa (header tabel tidak dihitung).
    const dataRows = isMobile ? 1 : 2;
    await expect(rows()).toHaveCount(dataRows, { timeout: 15_000 });
    expect(before).toBeGreaterThan(dataRows);
  });

  test("halaman master bisa dibuka di layar 375 px", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Cukup di viewport mobile.");
    await page.goto("/master");
    await expect(page.getByRole("link", { name: "Vendor" })).toBeVisible();
  });
});

test.describe("master data oleh viewer", () => {
  test.use({ storageState: storageStatePath("MANAGEMENT_VIEWER") });

  test("AC-02 viewer melihat daftar tanpa tombol aksi", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/master/vendors");
    await expect(
      isMobile
        ? page.getByRole("list", { name: "Daftar vendors" })
        : page.getByRole("table", { name: "vendors" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tambah vendor" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Aksi / })).toHaveCount(0);
  });
});
