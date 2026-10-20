import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { storageStatePath } from "./helpers/storage";

test.describe("menu Admin user", () => {
  test("tidak ada pelanggaran axe serius di halaman user", async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext({
      storageState: storageStatePath("SUPER_ADMIN"),
    });
    const page = await context.newPage();
    await page.goto("/admin/user");
    await expect(
      page.getByRole("table", { name: "Daftar user" }),
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious, "pelanggaran di /admin/user").toEqual([]);
    await context.close();
  });
  test("super admin membuat user dan mereset password", async ({ browser }) => {
    test.setTimeout(90_000);
    const context = await browser.newContext({
      storageState: storageStatePath("SUPER_ADMIN"),
    });
    const page = await context.newPage();
    await page.goto("/admin/user");
    await expect(
      page.getByRole("table", { name: "Daftar user" }),
    ).toBeVisible();

    const email = `e2e-user-${Date.now()}@wm.test`;
    await page.getByRole("button", { name: "Tambah user" }).click();
    const panel = page.getByRole("complementary", { name: "Tambah user" });
    await panel.getByLabel("Nama").fill("User Uji E2E");
    await panel.getByLabel("Email").fill(email);
    await panel.getByLabel("Peran").selectOption("MANAGEMENT_VIEWER");
    await panel.getByLabel("Password sementara").fill("PasswordSemnatak123!");
    await panel.getByRole("button", { name: "Simpan user" }).click();

    await expect(page.getByText("User dibuat")).toBeVisible({
      timeout: 20_000,
    });
    // Toast sonner menutupi tombol aksi di 375 px dan tidak selalu hilang tepat waktu; muat
    // ulang supaya baris user dibaca dari data server tanpa toast di atasnya.
    await page.reload();
    await expect(
      page.getByRole("table", { name: "Daftar user" }),
    ).toBeVisible();
    const row = page.getByRole("row", { name: new RegExp(email) });
    await expect(row).toBeVisible();
    await expect(row.getByText("Belum diganti")).toBeVisible();

    await row.getByRole("button", { name: /Aksi User Uji E2E/ }).click();
    await page.getByRole("menuitem", { name: "Reset password" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Password sementara").fill("PasswordReset456!");
    await dialog.getByRole("button", { name: "Reset password" }).click();
    await expect(page.getByText("Password direset")).toBeVisible({
      timeout: 20_000,
    });

    await context.close();
  });

  test("AC-03 specialist tidak bisa membuka halaman user", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: storageStatePath("WM_HO_SPECIALIST"),
    });
    const page = await context.newPage();
    await page.goto("/admin/user");
    await expect(page).toHaveURL(/\/dashboard$/);
    await context.close();
  });

  test("AC-02 viewer tidak melihat tautan user di menu admin", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: storageStatePath("MANAGEMENT_VIEWER"),
    });
    const page = await context.newPage();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
    await expect(page.getByRole("link", { name: "User" })).toHaveCount(0);
    await context.close();
  });
});
