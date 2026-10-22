import "./env";

import { spawnSync } from "node:child_process";
import { createReadStream, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const TEST_URL = process.env.TEST_DATABASE_URL;
const BACKUP_BUCKET = process.env.R2_BACKUP_BUCKET;
const BACKUP_ACCOUNT_ID = process.env.R2_BACKUP_ACCOUNT_ID;
const BACKUP_ACCESS_KEY_ID = process.env.R2_BACKUP_ACCESS_KEY_ID;
const BACKUP_SECRET_ACCESS_KEY = process.env.R2_BACKUP_SECRET_ACCESS_KEY;

if (!TEST_URL) {
  throw new Error("TEST_DATABASE_URL wajib diisi.");
}
if (
  !BACKUP_BUCKET ||
  !BACKUP_ACCOUNT_ID ||
  !BACKUP_ACCESS_KEY_ID ||
  !BACKUP_SECRET_ACCESS_KEY
) {
  throw new Error(
    "R2_BACKUP_BUCKET dan kredensial R2_BACKUP_* wajib diisi untuk backup harian.",
  );
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${BACKUP_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: BACKUP_ACCESS_KEY_ID,
    secretAccessKey: BACKUP_SECRET_ACCESS_KEY,
  },
});

const BACKUP_DIR = join(process.cwd(), ".backup-tmp");

function nowIsoSafe() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export function backupKey() {
  return `backups/wm-backup-${nowIsoSafe()}.sql`;
}

async function main() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const fileName = `wm-backup-${nowIsoSafe()}.sql`;
  const dumpPath = join(BACKUP_DIR, fileName);

  const dump = spawnSync("pg_dump", [TEST_URL!, "-f", dumpPath], {
    stdio: "inherit",
  });
  if (dump.status !== 0) {
    throw new Error(`pg_dump gagal (kode ${dump.status})`);
  }

  const key = backupKey();
  await client.send(
    new PutObjectCommand({
      Bucket: BACKUP_BUCKET,
      Key: key,
      Body: createReadStream(dumpPath),
    }),
  );
  console.log(`Backup terunggah ke R2 bucket ${BACKUP_BUCKET}: ${key}`);

  unlinkSync(dumpPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
