import { test } from "@playwright/test";

// Rule 35 §8 and the F0 prototype review need images at both viewports.
// Output goes to test-results/ (gitignored); copy the ones worth keeping into docs later.
const PAGES = [
  { name: "dashboard", url: "/dashboard" },
  { name: "proyek", url: "/proyek" },
  { name: "workspace", url: "/proyek/WM-THIP-2026-0001" },
  { name: "portofolio", url: "/portofolio" },
];

test("capture prototype screenshots", async ({ page }, testInfo) => {
  for (const target of PAGES) {
    await page.goto(target.url);
    await page.waitForLoadState("networkidle");
    const label = testInfo.project.name === "mobile" ? "375" : "1440";
    await page.screenshot({
      path: `test-results/screenshots/${target.name}-${label}.png`,
      fullPage: true,
    });
  }
});
