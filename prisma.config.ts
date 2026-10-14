import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Local secrets live in .env.local (never committed); CI and Vercel inject real env vars.
config({ path: ".env.local", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // docs/02 §8: CLI and migrations use the direct (non-pooled) connection.
    // Not `env()`: `prisma generate` must work in CI where no database URL exists.
    url: process.env.DIRECT_URL ?? "",
  },
});
