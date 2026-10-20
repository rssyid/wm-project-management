import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  // Menyiapkan akun uji di database yang dipakai `next start`.
  globalSetup: "./tests/e2e/global-setup.ts",
  // Neon branch dev punya compute kecil: transaksi paralel dari banyak worker bisa kehabisan
  // koneksi (Prisma P2028), jadi jumlah worker dibatasi.
  workers: process.env.CI ? 2 : 4,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // AFCE setup berantai banyak API call pada Neon compute kecil di CI; beri waktu test cukup.
  timeout: 120_000,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  // Rule 40: every UI flow is checked on desktop and at 375 px.
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "desktop",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  // Production build, not `next dev`: matches what is deployed and avoids dev-only overlays in axe.
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    // Better Auth menolak Origin yang tidak sama dengan BETTER_AUTH_URL; process env
    // menang atas .env.local, jadi port e2e tidak perlu sama dengan port dev.
    env: { BETTER_AUTH_URL: `http://localhost:${PORT}` },
  },
});
