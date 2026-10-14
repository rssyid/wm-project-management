import { prisma } from "@/infra/db";

/**
 * Every integration file starts from an empty database so fixtures never leak between
 * files. TRUNCATE does not fire the row-level immutable triggers from constraints.sql.
 */
async function truncateAll() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const list = tables.map((row) => `"${row.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
  );
}

await truncateAll();
