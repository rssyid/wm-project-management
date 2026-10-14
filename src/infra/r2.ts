import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * docs/02 §4: R2 memakai API S3. URL unggah berlaku 15 menit, URL unduh 5 menit, keduanya
 * dibuat server-side sehingga kredensial tidak pernah sampai ke browser.
 */
const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET;

if (!accountId || !bucket) {
  throw new Error("R2_ACCOUNT_ID dan R2_BUCKET wajib diisi.");
}

export const r2Bucket = bucket;

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

export async function presignUpload(
  key: string,
  mimeType: string,
): Promise<string> {
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mimeType }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );
}

export async function presignDownload(key: string): Promise<string> {
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    {
      expiresIn: DOWNLOAD_URL_TTL_SECONDS,
    },
  );
}

export type StoredObject = { sizeBytes: number; contentType: string | null };

/** Mengembalikan null bila objek belum ada di bucket. */
export async function statObject(key: string): Promise<StoredObject | null> {
  try {
    const result = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    return {
      sizeBytes: result.ContentLength ?? 0,
      contentType: result.ContentType ?? null,
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function removeObject(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

function isNotFound(error: unknown): boolean {
  const status = (error as { $metadata?: { httpStatusCode?: number } } | null)
    ?.$metadata?.httpStatusCode;
  return status === 404;
}

export const uploadUrlTtlSeconds = UPLOAD_URL_TTL_SECONDS;
export const downloadUrlTtlSeconds = DOWNLOAD_URL_TTL_SECONDS;
