import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { E2E_ACCOUNTS, E2E_PASSWORD, passwordChangeAccount } from "./accounts";
import { expectDashboard, signInWith } from "./helpers/auth";

test.describe("akses dan ganti password", () => {
  test("tidak ada pelanggaran axe serius di halaman login", async ({
    page,
  }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious, "pelanggaran di /login").toEqual([]);
  });
  test("AC-01 tanpa session diarahkan ke login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);

    await page.goto("/master");
    await expect(page).toHaveURL(/\/login\?next=%2Fmaster$/);

    await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible();
  });

  test("AC-01 endpoint tanpa session menjawab 401", async ({ request }) => {
    const response = await request.post("/api/me/password", {
      data: { newPassword: "PasswordTanpaSession123!", confirmPassword: "x" },
    });
    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHENTICATED" },
    });
  });

  test("AC-04 akun baru wajib ganti password sebelum masuk aplikasi", async ({
    page,
  }, testInfo) => {
    const account = passwordChangeAccount(testInfo.project.name);
    // Neon occasionally butuh lebih dari lima detik untuk menjawab sign-in.
    test.setTimeout(60_000);
    await signInWith(page, account.email, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/ubah-password$/, { timeout: 20_000 });

    await page
      .getByLabel("Password baru", { exact: true })
      .fill("PasswordBaru123!");
    await page.getByLabel("Ulangi password baru").fill("PasswordBeda123!");
    await page.getByRole("button", { name: "Simpan password" }).click();
    await expect(
      page.getByText("Pengulangan password tidak sama dengan password baru."),
    ).toBeVisible();

    await page.getByLabel("Ulangi password baru").fill("PasswordBaru123!");
    await page.getByRole("button", { name: "Simpan password" }).click();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: new RegExp(`Akun ${account.name}`) }),
    ).toBeVisible();
  });

  test("AC-01 email atau password salah ditolak", async ({ page }) => {
    test.setTimeout(60_000);
    await signInWith(
      page,
      E2E_ACCOUNTS.WM_HO_SPECIALIST.email,
      "PasswordSalah123!",
    );
    await expect(
      page.getByText("Email atau password salah, atau akun dinonaktifkan."),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("AC-01 tombol keluar mengakhiri session", async ({ page }) => {
    test.setTimeout(60_000);
    await signInWith(page, E2E_ACCOUNTS.WM_HO_SPECIALIST.email, E2E_PASSWORD);
    await expectDashboard(page);

    await page.getByRole("button", { name: /Akun E2E Specialist/ }).click();
    await page.getByRole("menuitem", { name: "Keluar" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
