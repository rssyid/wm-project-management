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
    await page.goto("/master/units");
    const list = isMobile
      ? page.getByRole("list", { name: "Daftar units" })
      : page.getByRole("table", { name: "units" });
    const firstRow = isMobile
      ? list.getByRole("listitem").first()
      : list.getByRole("row").nth(1);
    const nama = isMobile
      ? ((await firstRow.innerText()).split("\n")[0]?.trim() ?? "")
      : (await firstRow.getByRole("cell").nth(1).innerText()).trim();
    expect(nama.length).toBeGreaterThan(0);

    await page.getByPlaceholder("Nama atau kode").fill(nama);
    await page.getByRole("button", { name: "Saring" }).click();

    await expect(list).toBeVisible();
    await expect(list.getByText(nama).first()).toBeVisible();
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
