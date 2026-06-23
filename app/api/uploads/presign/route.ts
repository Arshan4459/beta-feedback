// Issues upload targets for voice clips. In production these are presigned S3
// PUT URLs (audio never touches this function); in dev they point at the local
// upload route. Stateless — does not touch the DB.

import { NextRequest } from "next/server";
import { clientIp, hashIp, presignSchema, rateLimit } from "@/lib/api";
import { createUploadTargets } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!rateLimit(`presign:${hashIp(clientIp(req))}`, 60, 60_000)) {
    return new Response("Too many requests", { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const parsed = presignSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid request" }, { status: 400 });

  try {
    const targets = await createUploadTargets(parsed.data.submissionId, parsed.data.files);
    return Response.json({ targets });
  } catch {
    return Response.json({ error: "could not create upload targets" }, { status: 400 });
  }
}
