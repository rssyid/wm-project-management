import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Local secrets live in .env.local (never committed); CI injects real env vars.
config({ path: ".env.local", quiet: true });

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
};

// Integration tests need a real PostgreSQL (rule 40: no Prisma mock) and never run in
// parallel — they truncate every table before each file.
const integrationUrl = process.env.TEST_DATABASE_URL ?? "";

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          fileParallelism: false,
          // Neon cold start and remote latency; local unit tests keep the default.
          testTimeout: 60_000,
          hookTimeout: 120_000,
          env: {
            DATABASE_URL: integrationUrl,
            DIRECT_URL: process.env.TEST_DIRECT_URL ?? "",
          },
        },
      },
    ],
  },
});
