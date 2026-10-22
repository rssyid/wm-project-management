import "./env";

import { spawnSync } from "node:child_process";
import { createWriteStream, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

const RESTORE_URL = process.env.RESTORE_DATABASE_URL;
const BACKUP_BUCKET = process.env.R2_BACKUP_BUCKET;
const BACKUP_ACCOUNT_ID = process.env.R2_BACKUP_ACCOUNT_ID;
const BACKUP_ACCESS_KEY_ID = process.env.R2_BACKUP_ACCESS_KEY_ID;
const BACKUP_SECRET_ACCESS_KEY = process.env.R2_BACKUP_SECRET_ACCESS_KEY;
const BACKUP_KEY = process.env.BACKUP_KEY;

if (!RESTORE_URL) {
  throw new Error("RESTORE_DATABASE_URL wajib diisi.");
}
if (
  !BACKUP_BUCKET ||
  !BACKUP_ACCOUNT_ID ||
  !BACKUP_ACCESS_KEY_ID ||
  !BACKUP_SECRET_ACCESS_KEY
) {
  throw new Error(
    "R2_BACKUP_BUCKET dan kredensial R2_BACKUP_* wajib diisi untuk restore.",
  );
}
if (!BACKUP_KEY) {
  throw new Error(
    "BACKUP_KEY wajib diisi (berkas cadangan yang akan direstore).",
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

async function main() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const fileName = join(BACKUP_DIR, `restore-${Date.now()}.sql`);

  const object = await client.send(
    new GetObjectCommand({ Bucket: BACKUP_BUCKET, Key: BACKUP_KEY }),
  );
  if (!object.Body) {
    throw new Error("Berkas cadangan tidak memiliki isi.");
  }

  const out = createWriteStream(fileName);
  await pipeline(object.Body as NodeJS.ReadableStream, out);
  console.log(`Berkas cadangan diunduh ke ${fileName}.`);

  const restore = spawnSync(
    "pg_restore",
    ["--clean", "--if-exists", "-d", RESTORE_URL!, fileName],
    {
      stdio: "inherit",
    },
  );
  if (restore.status !== 0) {
    throw new Error(`pg_restore gagal (kode ${restore.status})`);
  }

  unlinkSync(fileName);
  console.log("Restore ke branch terpisah selesai.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
