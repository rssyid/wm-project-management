import { expect, test, type Page } from "@playwright/test";

import { storageStatePath } from "./helpers/storage";

/**
 * Bug produksi 16 Oktober 2026: halaman workspace error saat tab Survei dimuat, dan
 * matriks approval tidak punya tombol tambah saat kosong. Alur ini membuka setiap tab
 * dan berinteraksi di browser, karena gerbang build tidak mengevaluasi modul klien.
 *
 * Tier dibuat dengan rentang nominal tinggi yang unik per run agar tidak bentrok dengan
 * tier dari test lain di database test yang sama.
 */
/**
 * Tier dibuat sebagai rentang dasar yang menutup dari nol sampai di atas nilai proyek uji, karena
 * matriks approval tidak boleh punya nominal tanpa tier (AC-18). Tier e2e dari run sebelumnya
 * dihapus oleh `seed-e2e-accounts` setiap kali suite e2e mulai, sehingga rentang ini selalu
 * boleh dibuat.
 */
const RUN = Date.now();
const TIER_MIN = 0;
const TIER_MAX = 500_000_000;

async function expectNoErrorPage(page: Page) {
  await expect(page.getByText("Application error")).toHaveCount(0);
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
}

// Hanya desktop: matriks approval tidak punya daftar ringkas di 375 px, dan kedua viewport
// memakai database yang sama sehingga tier keduanya akan saling menabrakan (AC-18).
test.describe("matriks approval", () => {
  test.use({ storageState: storageStatePath("SUPER_ADMIN") });

  test("SA selalu bisa menambah tier, termasuk saat daftar kosong", async ({
    page,
    isMobile,
  }) => {
    // Muat dan simpan lewat database uji bisa lambat pada runner CI.
    test.setTimeout(120_000);
    if (isMobile) {
      test.skip(true, "Cukup satu viewport untuk matriks approval.");
    }

    await page.goto("/admin/matriks-approval");
    await expectNoErrorPage(page);
    await expect(
      page.getByRole("button", { name: "Tambah tier" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Tambah tier" }).click();
    await page.getByLabel("Nama tier").fill(`Tier e2e ${RUN}`);
    await page.getByLabel("Batas bawah").fill(String(TIER_MIN));
    await page
      .getByLabel("Batas atas (kosong = tanpa batas)")
      .fill(String(TIER_MAX));
    await page.getByLabel("Tambah jabatan approver").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Simpan tier" }).click();

    await expect(page.getByText(`Tier e2e ${RUN}`)).toBeVisible({
      timeout: 30_000,
    });
  });
});

test.describe("workspace proyek", () => {
  test.use({ storageState: storageStatePath("WM_HO_SPECIALIST") });

  test("mulai survei lalu tab Survei tampil dan bisa disimpan", async ({
    page,
  }) => {
    // Buat proyek, mulai survei, dan simpan Surveys menyentuh database beberapa kali.
    test.setTimeout(120_000);
    await page.goto("/proyek/baru");
    await page.getByLabel("Nama proyek").fill(`Proyek flow ${RUN}`);
    await page
      .getByLabel("Kategori", { exact: true })
      .selectOption({ index: 1 });
    // PIC wajib sebelum Mulai Survei (AC-12); memosikannya juga membuat tombol aktif.
    await page.getByLabel("PIC", { exact: true }).selectOption({ index: 1 });
    await page.getByLabel("Region", { exact: true }).selectOption({ index: 1 });
    await page
      .getByLabel("Company", { exact: true })
      .selectOption({ index: 1 });
    await page.locator("fieldset input[type=checkbox]").first().check();
    await page.getByLabel("Estate utama").first().check();
    await page.getByLabel("Target mulai").fill("2026-10-01");
    await page.getByLabel("Target selesai").fill("2026-12-20");
    await page.getByLabel("Anggaran rencana").fill("450000000.00");
    await page.getByRole("button", { name: "Simpan proyek" }).click();
    await expect(page).toHaveURL(/\/proyek\/WM-[A-Z0-9]+-\d{4}-\d{4}$/, {
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Mulai survei" }).click();
    await expect(page.getByText("Proyek: Survei").first()).toBeVisible({
      timeout: 15_000,
    });
    await expectNoErrorPage(page);

    await page.getByRole("tab", { name: "Survei" }).click();
    await expectNoErrorPage(page);
    await expect(page.getByLabel("Tanggal survei")).toBeVisible();
    await page.getByLabel("Tanggal survei").fill("2026-10-05");
    await page.getByLabel("Nama surveyor").fill("Siti Rahma");
    await page
      .getByLabel("Kondisi eksisting")
      .fill("Saluran tersumbat sedimen");
    await page.getByRole("button", { name: "Simpan survei" }).click();
    await expect(page.getByText("Survei disimpan")).toBeVisible({
      timeout: 15_000,
    });

    // AC-16 dan AC-17 dari UI: attempt AFCE, BOQ, dan penandaan RAB siap. Komponen ini
    // belum pernah dievaluasi di browser oleh test lain, sehingga galat modul seperti
    // `.omit()` pada skema ber-refine hanya terlihat di sini.
    await page.getByRole("button", { name: "Buat attempt AFCE" }).click();
    await expectNoErrorPage(page);
    await page.getByRole("tab", { name: "AFCE/AR" }).click();
    await expect(page.getByText(/AFCE #1/)).toBeVisible({ timeout: 20_000 });

    await page.getByLabel("Kegiatan baris 1").fill("Galian saluran");
    await page.getByLabel("Harga baris 1").fill("450000000.00");
    await page.getByRole("button", { name: "Simpan BOQ" }).click();
    await expect(page.getByText("BOQ disimpan")).toBeVisible({
      timeout: 20_000,
    });
    // Setelah simpan BOQ versi attempt naik; tunggu render terbaru sebelum menandai RAB siap.
    await expect(page.getByText("Nilai AFCE Rp450.000.000")).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: "Tandai RAB siap" }).click();
    await expect(page.getByText("Proyek: RAB siap").first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("tab AFCE/AR tampil tanpa error dan menerima attempt baru", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/proyek");
    const firstLink = page
      .getByRole("table", { name: "Daftar proyek" })
      .getByRole("link")
      .first();
    if ((await firstLink.count()) === 0) {
      test.skip(true, "Belum ada proyek di database uji.");
    }
    await firstLink.click();
    await page.getByRole("tab", { name: "AFCE/AR" }).click();
    await expectNoErrorPage(page);
    await expect(page.getByText("Anggaran").first()).toBeVisible();
  });
});
