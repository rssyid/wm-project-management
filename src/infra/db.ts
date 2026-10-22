import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// pg-connection-string currently treats `prefer`/`require`/`verify-ca` as `verify-full` and warns
// that libpq semantics arrive in v3. Pin `verify-full` explicitly: same TLS guarantee, no warning.
function withVerifyFullTls(connectionString: string) {
  return connectionString.replace(
    /([?&]sslmode=)(prefer|require|verify-ca)(?=&|$)/,
    "$1verify-full",
  );
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  // docs/02 §8: runtime uses the pooled Neon URL through the pg driver adapter.
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: withVerifyFullTls(connectionString),
    }),
  });
}

// Reuse one client across dev hot reloads so connections are not exhausted.
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
