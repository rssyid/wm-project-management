import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Login lewat form sungguhan; dipakai test yang butuh akun khusus, bukan storageState. */
export async function signInWith(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
}

export function expectDashboard(page: Page) {
  return expect(page).toHaveURL(/\/dashboard$/);
}
