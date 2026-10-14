/** Akun e2e dibuat oleh tests/e2e/global-setup.ts di branch Neon dev. */
export const E2E_PASSWORD = "WmProjectE2E123!";

export type E2eRole = "SUPER_ADMIN" | "WM_HO_SPECIALIST" | "MANAGEMENT_VIEWER";

export const E2E_ACCOUNTS: Record<E2eRole, { email: string; name: string }> = {
  SUPER_ADMIN: { email: "e2e-sa@wm.test", name: "E2E Super Admin" },
  WM_HO_SPECIALIST: { email: "e2e-sp@wm.test", name: "E2E Specialist" },
  MANAGEMENT_VIEWER: { email: "e2e-mv@wm.test", name: "E2E Viewer" },
};

/**
 * Dipakai uji ganti password: password sementara membuat login pertama selalu
 * diarahkan ke /ubah-password (AC-04). Satu akun per project Playwright supaya desktop
 * dan 375 px tidak mengubah akun yang sama secara paralel.
 */
export const PASSWORD_CHANGE_ACCOUNTS = {
  desktop: {
    email: "e2e-ganti-password-desktop@wm.test",
    name: "E2E Ganti Password Desktop",
  },
  mobile: {
    email: "e2e-ganti-password-mobile@wm.test",
    name: "E2E Ganti Password Mobile",
  },
};

export function passwordChangeAccount(projectName: string) {
  return projectName === "mobile"
    ? PASSWORD_CHANGE_ACCOUNTS.mobile
    : PASSWORD_CHANGE_ACCOUNTS.desktop;
}

export const ALL_E2E_ACCOUNTS = [
  { ...E2E_ACCOUNTS.SUPER_ADMIN, role: "SUPER_ADMIN" },
  { ...E2E_ACCOUNTS.WM_HO_SPECIALIST, role: "WM_HO_SPECIALIST" },
  { ...E2E_ACCOUNTS.MANAGEMENT_VIEWER, role: "MANAGEMENT_VIEWER" },
  { ...PASSWORD_CHANGE_ACCOUNTS.desktop, role: "WM_HO_SPECIALIST" },
  { ...PASSWORD_CHANGE_ACCOUNTS.mobile, role: "WM_HO_SPECIALIST" },
] as const;
