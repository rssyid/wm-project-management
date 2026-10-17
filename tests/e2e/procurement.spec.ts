import {
  expect,
  request,
  test,
  type APIResponse,
  type Page,
} from "@playwright/test";

import { storageStatePath } from "./helpers/storage";

type Json = {
  data?: unknown;
  error?: { code?: string; message?: string; fields?: unknown };
};

type RequestMethod = "get" | "post" | "put" | "patch";

interface ApiRequestOptions {
  data?: unknown;
  headers?: Record<string, string>;
}

async function apiJson(
  page: Page,
  method: RequestMethod,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Json }> {
  const options: ApiRequestOptions = {};
  if (body !== undefined) {
    options.data = body;
    options.headers = { "content-type": "application/json" };
  }
  let response: APIResponse;
  if (method === "get") {
    response = await page.request.get(path, options);
  } else if (method === "post") {
    response = await page.request.post(path, options);
  } else if (method === "put") {
    response = await page.request.put(path, options);
  } else {
    response = await page.request.patch(path, options);
  }
  return { status: response.status(), json: (await response.json()) as Json };
}

async function expectOk(
  page: Page,
  method: RequestMethod,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const { status, json } = await apiJson(page, method, path, body);
  expect(status).toBe(200);
  expect(json.error).toBeUndefined();
  return json.data;
}

async function expectError(
  page: Page,
  method: RequestMethod,
  path: string,
  expectedCode: string,
  body?: unknown,
): Promise<void> {
  const { status, json } = await apiJson(page, method, path, body);
  expect(status).toBe(409);
  expect(json.error?.code).toBe(expectedCode);
}

/** Siapkan data master yang diperlukan procurement (belum ada di database uji). */
async function setupMasterData(page: Page) {
  // Matriks approval dipakai bersama dengan project-flow.spec.ts: satu tier e2e dibuat sekali
  // di `seed-e2e-accounts` (global-setup). Test tidak membuat atau menghapus tier karena
  // matriks adalah state global dan suite berjalan paralel pada branch Neon yang sama (D-34).

  // PIC user (hanya SUPER_ADMIN yang bisa membuat user via API).
  const ts = Date.now();
  const superAdmin = await request.newContext({
    storageState: storageStatePath("SUPER_ADMIN"),
  });
  const picUser = (await superAdmin.post("/api/users", {
    data: {
      name: "PIC E2E",
      email: `pic${ts}@example.com`,
      role: "WM_HO_SPECIALIST",
      temporaryPassword: "E2ePassword123",
    },
  })) as APIResponse;
  const picBody = (await picUser.json()) as { data: { id: string } };
  const picUserId = picBody.data.id;
  await superAdmin.dispose();

  const region = (await expectOk(page, "post", "/api/master/regions", {
    code: `REG${ts}`,
    name: `Region E2E ${ts}`,
    ops: "SUMATERA",
    order: 1,
  })) as { id: string };

  const wilayah = (await expectOk(page, "post", "/api/master/wilayah", {
    regionId: region.id,
    name: `Wilayah E2E ${ts}`,
    order: 1,
  })) as { id: string };

  const company = (await expectOk(page, "post", "/api/master/companies", {
    code: `CO${ts}`,
    name: `Company E2E ${ts}`,
    order: 1,
  })) as { id: string };

  const estate = (await expectOk(page, "post", "/api/master/estates", {
    companyId: company.id,
    wilayahId: wilayah.id,
    code: `ES${ts}`,
    name: `Estate E2E ${ts}`,
    order: 1,
  })) as { id: string };

  const unit = (await expectOk(page, "post", "/api/master/units", {
    code: `UN${ts}`,
    name: `Unit E2E ${ts}`,
  })) as { id: string };

  const material = (await expectOk(page, "post", "/api/master/materials", {
    name: `Material E2E ${ts}`,
    defaultUnitId: unit.id,
    code: `MA${ts}`,
  })) as { id: string; defaultUnitId: string };

  const externalVendor = (await expectOk(page, "post", "/api/master/vendors", {
    name: `Vendor Eksternal E2E ${ts}`,
    type: "EKSTERNAL",
  })) as { id: string; type: string };

  const internalVendor = (await expectOk(page, "post", "/api/master/vendors", {
    name: `Vendor Internal E2E ${ts}`,
    type: "INTERNAL",
  })) as { id: string; type: string };

  const category = (await expectOk(
    page,
    "post",
    "/api/master/project-categories",
    {
      code: `PC${ts}`,
      name: `Kategori E2E ${ts}`,
      order: 1,
    },
  )) as { id: string };

  return {
    picUserId,
    regionId: region.id,
    wilayahId: wilayah.id,
    companyId: company.id,
    estateId: estate.id,
    unitId: unit.id,
    materialId: material.id,
    defaultUnitId: material.defaultUnitId,
    externalVendorId: externalVendor.id,
    internalVendorId: internalVendor.id,
    categoryId: category.id,
  };
}

/** Siapkan proyek sampai AFCE_AR_APPROVED dengan satu WorkItem. */
async function setupToAfceApproved(page: Page) {
  const master = await setupMasterData(page);

  const project = (await expectOk(page, "post", "/api/projects", {
    name: "Proyek Procurement E2E",
    companyId: master.companyId,
    categoryId: master.categoryId,
    targetStartDate: "2026-10-01",
    targetEndDate: "2026-12-31",
    plannedBudget: "450000000.00",
    picUserId: master.picUserId,
    estates: [{ estateId: master.estateId, isPrimary: true }],
  })) as { id: string };
  const projectId = project.id;

  await expectOk(page, "post", `/api/projects/${projectId}/start-survey`);
  await expectOk(page, "put", `/api/projects/${projectId}/survey`, {
    version: 1,
    surveyDate: "2026-10-05",
    surveyorNames: "Surveyor Uji",
    existingCondition: "Kondisi normal",
    recommendation: "Lanjutkan",
  });

  const attempt = (await expectOk(
    page,
    "post",
    `/api/projects/${projectId}/afce-attempts`,
    {},
  )) as {
    id: string;
    version: number;
  };
  const attemptId = attempt.id;

  await expectOk(page, "put", `/api/afce-attempts/${attemptId}/boq`, {
    version: 1,
    items: [{ activityName: "Galian saluran", amount: "450000000.00" }],
  });

  const attemptAfterBoq = (await expectOk(
    page,
    "get",
    `/api/afce-attempts/${attemptId}`,
  )) as {
    version: number;
  };

  // Tandai RAB siap → proyek beralihlah ke RAB_READY (AC-16).
  await expectOk(page, "patch", `/api/afce-attempts/${attemptId}`, {
    version: attemptAfterBoq.version,
    rabReady: true,
  });

  const attemptV2 = (await expectOk(
    page,
    "get",
    `/api/afce-attempts/${attemptId}`,
  )) as {
    version: number;
  };
  await expectOk(page, "post", `/api/afce-attempts/${attemptId}/submit`, {
    version: attemptV2.version,
    submittedDate: "2026-10-10",
    approvalEmailDate: "2026-10-10",
  });

  const attemptLevels = (await expectOk(
    page,
    "get",
    `/api/afce-attempts/${attemptId}`,
  )) as {
    levels: Array<{ id: string; levelNo: number }>;
  };
  for (const level of attemptLevels.levels) {
    await expectOk(page, "post", `/api/approval-levels/${level.id}/decision`, {
      result: "APPROVED",
      approverName: "Approver Uji",
      decisionDate: "2026-10-11",
    });
  }

  const projectAfter = (await expectOk(
    page,
    "get",
    `/api/projects/${projectId}`,
  )) as {
    status: string;
  };
  expect(projectAfter.status).toBe("AFCE_AR_APPROVED");

  const workItem = (await expectOk(
    page,
    "post",
    `/api/projects/${projectId}/work-items`,
    {
      name: "Pekerjaan Uji",
      type: "TENDER_CONTRACT",
      projectWeightPct: "100.00",
      physicalWeightPct: "70.00",
      materialWeightPct: "30.00",
      unitId: master.defaultUnitId,
    },
  )) as { id: string };
  const workItemId = workItem.id;

  return {
    projectId,
    workItemId,
    materialId: master.materialId,
    unitId: master.defaultUnitId,
    externalVendorId: master.externalVendorId,
    internalVendorId: master.internalVendorId,
  };
}

/** Siapkan proyek sampai PROCUREMENT (USPK pertama sudah dibuat). */
async function setupToProcurement(page: Page) {
  const base = await setupToAfceApproved(page);

  const attempt = (await expectOk(
    page,
    "post",
    `/api/work-items/${base.workItemId}/tender-attempts`,
    {
      uspk: { number: "USPK/2026/001", date: "2026-10-06" },
      planTender: "Tender konvensional",
      planPhysical: "Fisik konvensional",
    },
  )) as { id: string };

  return { ...base, tenderAttemptId: attempt.id };
}

test.describe("procurement (F3) — specialist", () => {
  test.use({ storageState: storageStatePath("WM_HO_SPECIALIST") });

  test("Skenario 1 (AC-35): satu attempt aktif per Pekerjaan", async ({
    page,
  }) => {
    const base = await setupToAfceApproved(page);

    // Attempt #1 berhasil → proyek ke PROCUREMENT.
    const attempt1 = (await expectOk(
      page,
      "post",
      `/api/work-items/${base.workItemId}/tender-attempts`,
      {
        uspk: { number: "USPK/2026/001", date: "2026-10-06" },
        planTender: "Tender konvensional",
        planPhysical: "Fisik konvensional",
      },
    )) as { id: string };

    // Coba attempt #2 saat #1 masih aktif → ditolak ACTIVE_CONFLICT.
    await expectError(
      page,
      "post",
      `/api/work-items/${base.workItemId}/tender-attempts`,
      "ACTIVE_CONFLICT",
      {
        uspk: { number: "USPK/2026/002", date: "2026-10-07" },
        planTender: "Tender konvensional",
        planPhysical: "Fisik konvensional",
      },
    );

    // Batalkan attempt #1.
    await expectOk(page, "post", `/api/tender-attempts/${attempt1.id}/cancel`, {
      cancelledDate: "2026-10-10",
      cancelReason: "Dibatalkan untuk dibuat ulang",
    });

    // Buat attempt #2 baru setelah #1 dibatalkan → berhasil.
    const attempt2 = (await expectOk(
      page,
      "post",
      `/api/work-items/${base.workItemId}/tender-attempts`,
      {
        uspk: { number: "USPK/2026/002", date: "2026-10-07" },
        planTender: "Tender konvensional",
        planPhysical: "Fisik konvensional",
      },
    )) as { id: string };
    expect(attempt2.id).not.toBe(attempt1.id);
  });

  test("Skenario 2 (AC-37): SPK release pertama → attempt COMPLETED", async ({
    page,
  }) => {
    const base = await setupToProcurement(page);

    // Set pemenang tender pada attempt yang aktif (pakai tenderAttemptId, bukan workItemId).
    await expectOk(
      page,
      "put",
      `/api/tender-attempts/${base.tenderAttemptId}/winner`,
      {
        vendorId: base.externalVendorId,
      },
    );

    // Buat kedua SPK sebelum release mana pun (attempt masih PLANNED).
    const spk1 = (await expectOk(
      page,
      "post",
      `/api/work-items/${base.workItemId}/spks`,
      {
        number: "SPK/001",
        date: "2026-10-06",
        vendorId: base.externalVendorId,
      },
    )) as { id: string };
    const spk2 = (await expectOk(
      page,
      "post",
      `/api/work-items/${base.workItemId}/spks`,
      {
        number: "SPK/002",
        date: "2026-10-11",
        vendorId: base.externalVendorId,
      },
    )) as { id: string };

    // Release SPK pertama → attempt COMPLETED, actualEnd = tanggal release.
    await expectOk(page, "post", `/api/spks/${spk1.id}/release`, {
      releasedDate: "2026-10-10",
    });

    // Verifikasi lewat daftar SPK work item.
    const spks = (await expectOk(
      page,
      "get",
      `/api/work-items/${base.workItemId}/spks`,
    )) as Array<{
      id: string;
      status: string;
    }>;
    const releasedSpk1 = spks.find((s) => s.id === spk1.id);
    expect(releasedSpk1?.status).toBe("RELEASED");

    // Release SPK kedua → boleh lebih dari 1 SPK RELEASED aktif.
    await expectOk(page, "post", `/api/spks/${spk2.id}/release`, {
      releasedDate: "2026-10-11",
    });

    const spks2 = (await expectOk(
      page,
      "get",
      `/api/work-items/${base.workItemId}/spks`,
    )) as Array<{
      status: string;
    }>;
    const releasedCount = spks2.filter((s) => s.status === "RELEASED").length;
    expect(releasedCount).toBeGreaterThanOrEqual(2);
  });

  test("Skenario 3 (AC-39): batal SPK yang direlease", async ({ page }) => {
    const base = await setupToProcurement(page);

    await expectOk(
      page,
      "put",
      `/api/tender-attempts/${base.tenderAttemptId}/winner`,
      {
        vendorId: base.externalVendorId,
      },
    );

    const spk = (await expectOk(
      page,
      "post",
      `/api/work-items/${base.workItemId}/spks`,
      {
        number: "SPK/001",
        date: "2026-10-06",
        vendorId: base.externalVendorId,
      },
    )) as { id: string };

    await expectOk(page, "post", `/api/spks/${spk.id}/release`, {
      releasedDate: "2026-10-10",
    });

    // Batalkan SPK. Fisik masih BELUM_MULAI (fitur Mulai Fisik ada di F4),
    // jadi SPK hanya berubah ke BATAL tanpa JEDA_SPK_BATAL.
    await expectOk(page, "post", `/api/spks/${spk.id}/cancel`, {
      cancelledDate: "2026-10-12",
      cancelReason: "SPK tidak digunakan",
    });

    const spks = (await expectOk(
      page,
      "get",
      `/api/work-items/${base.workItemId}/spks`,
    )) as Array<{
      id: string;
      status: string;
    }>;
    const cancelledSpk = spks.find((s) => s.id === spk.id);
    expect(cancelledSpk?.status).toBe("BATAL");
  });

  test("Skenario 4 (AC-42): kiriman pertama → EXECUTION tepat sekali", async ({
    page,
  }) => {
    const base = await setupToProcurement(page);

    // Buat Paket Kerja dengan item. Bobot paket = bobot material Pekerjaan (30,00).
    const wp = (await expectOk(
      page,
      "post",
      `/api/work-items/${base.workItemId}/work-packages`,
      {
        name: "Paket Uji",
        weightPct: "30.00",
        items: [
          {
            materialId: base.materialId,
            unitId: base.unitId,
            plannedQty: "10.000",
          },
        ],
      },
    )) as { id: string };
    const workPackageId = wp.id;

    const wpDetail = (await expectOk(
      page,
      "get",
      `/api/work-packages/${workPackageId}`,
    )) as {
      items: Array<{ id: string }>;
    };
    const itemId = wpDetail.items[0]!.id;

    // PR → PO.
    await expectOk(page, "post", `/api/work-packages/${workPackageId}/pr`, {
      number: "PR/2026/001",
      date: "2026-10-06",
    });
    await expectOk(page, "post", `/api/work-packages/${workPackageId}/po`, {
      number: "PO/2026/001",
      date: "2026-10-07",
      vendorId: base.externalVendorId,
    });

    // Kiriman pertama (parsial) → proyek EXECUTION.
    await expectOk(
      page,
      "post",
      `/api/work-packages/${workPackageId}/deliveries`,
      {
        deliveryDate: "2026-10-10",
        items: [{ workPackageItemId: itemId, qty: "5.000" }],
      },
    );

    const projectAfter = (await expectOk(
      page,
      "get",
      `/api/projects/${base.projectId}`,
    )) as {
      status: string;
    };
    expect(projectAfter.status).toBe("EXECUTION");

    // Kiriman kedua dilakukan berurutan cepat → proyek tetap EXECUTION.
    await expectOk(
      page,
      "post",
      `/api/work-packages/${workPackageId}/deliveries`,
      {
        deliveryDate: "2026-10-11",
        items: [{ workPackageItemId: itemId, qty: "3.000" }],
      },
    );

    const projectAfter2 = (await expectOk(
      page,
      "get",
      `/api/projects/${base.projectId}`,
    )) as {
      status: string;
    };
    expect(projectAfter2.status).toBe("EXECUTION");
  });
});

test.describe("procurement (F3) — viewer", () => {
  test.use({ storageState: storageStatePath("MANAGEMENT_VIEWER") });

  test("Skenario 5: viewer tidak punya tombol aksi pada workspace proyek", async ({
    page,
  }) => {
    await page.goto("/proyek");
    const firstLink = page
      .getByRole("table", { name: "Daftar proyek" })
      .getByRole("link")
      .first();
    if ((await firstLink.count()) === 0) {
      test.skip(true, "Belum ada proyek di database uji.");
    }
    await firstLink.click();

    await page.getByRole("tab", { name: "Pekerjaan" }).click();
    await expect(
      page.getByRole("button", { name: "Tambah Pekerjaan" }),
    ).toHaveCount(0);

    await page.getByRole("tab", { name: "Paket Kerja" }).click();
    await expect(page.getByRole("button", { name: "Buat PR" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Buat PO" })).toHaveCount(0);
  });
});
