import { expect, test } from "@playwright/test";

import { storageStatePath } from "./helpers/storage";

/** docs/01 §2 dan AC-02: peran berasal dari session, bukan pemilih peran prototipe. */
test.describe("viewer tanpa tombol aksi", () => {
  test.use({ storageState: storageStatePath("MANAGEMENT_VIEWER") });

  test("melihat daftar proyek tanpa aksi buat proyek", async ({ page }) => {
    await page.goto("/proyek");
    await expect(page.getByRole("heading", { name: "Proyek" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Buat proyek" })).toHaveCount(
      0,
    );
    // Tabel atau daftar ringkas hanya muncul bila ada proyek; bar filter selalu ada.
    await expect(page.getByRole("button", { name: "Saring" })).toBeVisible();
  });
});

test.describe("specialist melihat tombol aksi", () => {
  test.use({ storageState: storageStatePath("WM_HO_SPECIALIST") });

  test("tombol buat proyek tampil", async ({ page }) => {
    await page.goto("/proyek");
    await expect(page.getByRole("link", { name: "Buat proyek" })).toBeVisible();
  });
});

test.describe("AC-03 menu admin per peran", () => {
  test("specialist hanya melihat audit log", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: storageStatePath("WM_HO_SPECIALIST"),
    });
    const page = await context.newPage();
    await page.goto("/admin");
    await expect(page.getByRole("list", { name: "Menu admin" })).toContainText([
      "Audit log",
    ]);
    await expect(page.getByText("Matriks approval")).toHaveCount(0);
    await context.close();
  });

  test("super admin melihat seluruh menu admin", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: storageStatePath("SUPER_ADMIN"),
    });
    const page = await context.newPage();
    await page.goto("/admin");
    await expect(page.getByText("Matriks approval")).toBeVisible();
    await expect(page.getByText("Audit log")).toBeVisible();
    await context.close();
  });
});
