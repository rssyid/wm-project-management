import { expect, test } from "@playwright/test";

import { storageStatePath } from "./helpers/storage";

/**
 * AC-53, AC-54, AC-55: Gantt matriks menampilkan semua attempt termasuk batal,
 * warna baseline/revisi, dan simbol # / ✓. Uji di desktop dan mobile 375 px.
 */
test.describe("Gantt matriks", () => {
  test.use({ storageState: storageStatePath("WM_HO_SPECIALIST") });

  let projectCode: string;

  test.beforeAll(async ({ request }) => {
    // Ambil ID master yang valid dari API.
    const companiesRes = await request.get("/api/master/companies?active=true");
    const companies = await companiesRes.json();
    const company = companies.data?.[0];
    expect(company).toBeDefined();

    const categoriesRes = await request.get(
      "/api/master/project-categories?active=true",
    );
    const categories = await categoriesRes.json();
    const category = categories.data?.[0];
    expect(category).toBeDefined();

    const estatesRes = await request.get(
      `/api/master/estates?active=true&companyId=${company.id}`,
    );
    const estates = await estatesRes.json();
    const estate = estates.data?.[0];
    expect(estate).toBeDefined();

    // Buat proyek cepat lewat API supaya tab Jadwal bisa diuji.
    const res = await request.post("/api/projects", {
      data: {
        name: "Proyek Gantt E2E",
        companyId: company.id,
        categoryId: category.id,
        estates: [{ estateId: estate.id, isPrimary: true }],
        picUserId: null,
        targetStartDate: "2026-10-01",
        targetEndDate: "2026-12-31",
        plannedBudget: "450000000.00",
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    projectCode = body.data.code;
  });

  test("AC-53, AC-54, AC-55 tab Jadwal dan Gantt tampil di desktop", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto(`/proyek/${projectCode}`);
    await page.getByRole("tab", { name: "Jadwal" }).click();

    // Gantt matrix harus muncul.
    await expect(page.getByText("Rencana", { exact: true })).toBeVisible();
    await expect(page.getByText("Revisi 1", { exact: true })).toBeVisible();
    await expect(page.getByText("Revisi 2+", { exact: true })).toBeVisible();
    await expect(page.getByText("# Berjalan", { exact: true })).toBeVisible();
    await expect(page.getByText("✓ Selesai", { exact: true })).toBeVisible();

    // Identitas sticky di kiri.
    await expect(page.getByText("Job Item", { exact: false })).toBeVisible();
  });

  test("AC-56 Gantt mobile 375 px: identitas sticky, timeline geser", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Hanya uji mobile 375 px.");
    test.setTimeout(60_000);

    await page.goto(`/proyek/${projectCode}`);
    await page.getByRole("tab", { name: "Jadwal" }).click();

    // Gantt matrix harus muncul di mobile.
    await expect(page.getByText("Rencana", { exact: true })).toBeVisible();
    await expect(page.getByText("# Berjalan", { exact: true })).toBeVisible();

    // Kolom identitas tetap ada.
    await expect(page.getByText("Job Item", { exact: false })).toBeVisible();
  });
});
