// Receives a submission: validates answers against the question schema, persists
// the submission + one voice_answers row per clip (status 'pending', which the
// transcription worker later claims). Idempotent on submissionId.

import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb, schema } from "@/lib/db";
import {
  clientIp,
  hashIp,
  rateLimit,
  submitSchema,
  validateAnswers,
  validateClips,
} from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`submit:${hashIp(ip)}`, 20, 60_000)) {
    return new Response("Too many requests", { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid request" }, { status: 400 });
  const { submissionId, submittedAt, answers, clips } = parsed.data;

  const { ok, errors, clean } = validateAnswers(answers);
  if (!ok) return Response.json({ error: "validation failed", details: errors }, { status: 400 });
  const validClips = validateClips(clips, submissionId, clean);

  const str = (k: string) => (typeof clean[k] === "string" ? (clean[k] as string) : null);

  try {
    const db = await getDb();

    // Idempotent insert: a retried submission (same id) is a no-op success.
    const inserted = await db
      .insert(schema.submissions)
      .values({
        id: submissionId,
        admissionNo: str("admission_no") ?? "",
        grade: str("grade"),
        device: str("device"),
        overallKeep: str("overall_keep"),
        answers: clean,
        voiceAnswers: validClips.map((c) => c.questionKey),
        submittedAt: submittedAt ? new Date(submittedAt) : null,
        ipHash: hashIp(ip),
        userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      })
      .onConflictDoNothing({ target: schema.submissions.id })
      .returning({ id: schema.submissions.id });

    if (inserted.length === 0) return Response.json({ ok: true, deduped: true });

    if (validClips.length > 0) {
      await db.insert(schema.voiceAnswers).values(
        validClips.map((c) => ({
          id: randomUUID(),
          submissionId,
          questionKey: c.questionKey,
          objectKey: c.objectKey,
          contentType: c.contentType ?? null,
          bytes: c.bytes ?? null,
          durationSec: c.durationSec ?? null,
          transcriptStatus: "pending" as const,
        })),
      );
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error("submit db error:", e);
    const err = e as { message?: string; cause?: { message?: string } };
    return Response.json(
      { error: "Could not save submission", cause: err?.cause?.message ?? err?.message ?? String(e) },
      { status: 500 },
    );
  }
}
