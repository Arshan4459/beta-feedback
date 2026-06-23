// Object storage abstraction.
//   - S3 mode (S3_BUCKET set): presigned PUT URLs to S3-compatible storage
//     (MinIO on your box, or R2/S3). Audio uploads bypass the API entirely.
//   - local mode (default dev): uploads go to a Next route that writes to disk,
//     so the full presigned-upload flow works with zero infra.

import { promises as fs } from "node:fs";
import path from "node:path";

const DRIVER: "s3" | "local" =
  (process.env.STORAGE_DRIVER as "s3" | "local") ?? (process.env.S3_BUCKET ? "s3" : "local");

const LOCAL_DIR = process.env.LOCAL_STORAGE_DIR ?? "./.uploads";

/** Per-clip hard cap (≈ 2 min of audio is ~2 MB; allow headroom). */
export const MAX_AUDIO_BYTES = Number(process.env.MAX_AUDIO_BYTES ?? String(15 * 1024 * 1024));

export const ALLOWED_EXT = new Set(["webm", "ogg", "m4a", "mp4", "bin"]);

export interface UploadFile {
  questionKey: string;
  contentType: string;
  ext: string;
}

export interface UploadTarget {
  questionKey: string;
  objectKey: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY_RE = /^[a-z0-9_]+$/;

/** Build a safe object key; throws on anything that could escape the prefix. */
export function objectKeyFor(submissionId: string, questionKey: string, ext: string): string {
  if (!UUID_RE.test(submissionId)) throw new Error("bad submissionId");
  if (!KEY_RE.test(questionKey)) throw new Error("bad questionKey");
  if (!ALLOWED_EXT.has(ext)) throw new Error("bad ext");
  return `submissions/${submissionId}/${questionKey}.${ext}`;
}

// ---- S3 client (lazy) ----
let _s3: Promise<{ client: import("@aws-sdk/client-s3").S3Client; bucket: string }> | null = null;
async function s3() {
  if (!_s3) {
    _s3 = (async () => {
      const { S3Client } = await import("@aws-sdk/client-s3");
      const client = new S3Client({
        region: process.env.S3_REGION ?? "us-east-1",
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
        // Non-AWS S3-compatible stores (Supabase, R2, B2) reject the checksum
        // headers the SDK now adds by default — only send them when required.
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
        },
      });
      return { client, bucket: process.env.S3_BUCKET ?? "" };
    })();
  }
  return _s3;
}

export async function createUploadTargets(
  submissionId: string,
  files: UploadFile[],
): Promise<UploadTarget[]> {
  if (DRIVER === "s3") {
    const { client, bucket } = await s3();
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    return Promise.all(
      files.map(async (f) => {
        const objectKey = objectKeyFor(submissionId, f.questionKey, f.ext);
        const uploadUrl = await getSignedUrl(
          client,
          new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: f.contentType }),
          { expiresIn: 600 },
        );
        return {
          questionKey: f.questionKey,
          objectKey,
          uploadUrl,
          method: "PUT" as const,
          headers: { "Content-Type": f.contentType },
        };
      }),
    );
  }
  // local dev: client PUTs to our own route which writes to disk
  return files.map((f) => {
    const objectKey = objectKeyFor(submissionId, f.questionKey, f.ext);
    return {
      questionKey: f.questionKey,
      objectKey,
      uploadUrl: `/api/uploads/local/${objectKey}`,
      method: "PUT" as const,
      headers: { "Content-Type": f.contentType },
    };
  });
}

// ---- local-disk helpers (dev) ----
function localPath(objectKey: string): string {
  const root = path.resolve(LOCAL_DIR);
  const full = path.resolve(root, objectKey);
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error("path traversal");
  return full;
}

export async function putLocalObject(objectKey: string, body: Buffer): Promise<void> {
  const full = localPath(objectKey);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body);
}

export async function getObjectBytes(objectKey: string): Promise<Buffer> {
  if (DRIVER === "s3") {
    const { client, bucket } = await s3();
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }
  return fs.readFile(localPath(objectKey));
}

/** A URL the GTM team can use to fetch a clip (used by export). */
export async function getDownloadUrl(objectKey: string, expiresSec = 3600): Promise<string> {
  if (DRIVER === "s3") {
    const { client, bucket } = await s3();
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: objectKey }), {
      expiresIn: expiresSec,
    });
  }
  return `/api/uploads/local/${objectKey}`;
}

export const storageDriver = DRIVER;
export const isLocalStorage = DRIVER === "local";
