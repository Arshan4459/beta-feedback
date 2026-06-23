// Dev-only object store: receives the "presigned" PUT and serves clips back.
// In production, STORAGE_DRIVER=s3 and uploads go straight to S3/MinIO — this
// route returns 404 there.

import { NextRequest } from "next/server";
import {
  MAX_AUDIO_BYTES,
  getObjectBytes,
  isLocalStorage,
  putLocalObject,
} from "@/lib/storage";
import { clientIp, hashIp, rateLimit } from "@/lib/api";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
};

export async function PUT(req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  if (!isLocalStorage) return new Response("Not found", { status: 404 });
  if (!rateLimit(`upload:${hashIp(clientIp(req))}`, 120, 60_000)) {
    return new Response("Too many requests", { status: 429 });
  }
  const { key } = await ctx.params;
  const objectKey = key.join("/");
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.byteLength > MAX_AUDIO_BYTES) return new Response("Too large", { status: 413 });
  try {
    await putLocalObject(objectKey, buf);
  } catch {
    return new Response("Bad key", { status: 400 });
  }
  return new Response(null, { status: 200 });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  if (!isLocalStorage) return new Response("Not found", { status: 404 });
  const { key } = await ctx.params;
  const objectKey = key.join("/");
  const ext = objectKey.split(".").pop() ?? "";
  try {
    const bytes = await getObjectBytes(objectKey);
    return new Response(bytes as unknown as BodyInit, {
      headers: { "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
