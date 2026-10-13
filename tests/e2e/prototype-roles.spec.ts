import { expect, test, type Page } from "@playwright/test";

import { PROTOTYPE_ROLE_COOKIE } from "@/prototype/role";

/** D-21: set the simulated role before the app reads its cookie. */
async function useRole(page: Page, role: string) {
  await page.context().addCookies([
    {
      name: PROTOTYPE_ROLE_COOKIE,
      value: role,
      url: "http://localhost:3100",
    },
  ]);
}

test.describe("peran prototipe", () => {
  test("viewer melihat daftar proyek tanpa tombol aksi", async ({
    page,
    isMobile,
  }) => {
    await useRole(page, "MANAGEMENT_VIEWER");
    await page.goto("/proyek");
    await expect(page.getByRole("button", { name: "Buat proyek" })).toHaveCount(
      0,
    );
    // D-20: di bawah 768 px baris tabel menjadi daftar ringkas, bukan tabel.
    await expect(
      isMobile
        ? page.getByRole("list", { name: "Daftar proyek" })
        : page.getByRole("table", { name: "Daftar proyek" }),
    ).toBeVisible();
  });

  test("specialist melihat tombol aksi", async ({ page }) => {
    await useRole(page, "WM_HO_SPECIALIST");
    await page.goto("/proyek");
    await expect(
      page.getByRole("button", { name: "Buat proyek" }),
    ).toBeVisible();
  });

  test("admin hanya menampilkan audit log untuk specialist dan viewer", async ({
    page,
  }) => {
    await useRole(page, "WM_HO_SPECIALIST");
    await page.goto("/admin");
    await expect(page.getByRole("list", { name: "Menu admin" })).toContainText([
      "Audit log",
    ]);
    await expect(page.getByText("Matriks approval")).toHaveCount(0);

    await useRole(page, "SUPER_ADMIN");
    await page.goto("/admin");
    await expect(page.getByText("Matriks approval")).toBeVisible();
    await expect(page.getByText("Audit log")).toBeVisible();
  });
});
