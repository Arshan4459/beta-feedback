// Authenticated export for the GTM/Product team.
//   GET /api/export?format=json   -> submissions + voice answers + transcripts + audio URLs
//   GET /api/export?format=csv    -> one flattened row per submission
// Auth: `Authorization: Bearer <EXPORT_TOKEN>` (or ?token=). Disabled until
// EXPORT_TOKEN is set, so it can never leak data by default.

import { NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { ALL_QUESTIONS } from "@/lib/schema";
import { getDownloadUrl } from "@/lib/storage";
import type { Submission, VoiceAnswer } from "@/lib/db/schema";

export const runtime = "nodejs";

function isAuthed(req: NextRequest, token: string): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ")
    ? auth.slice(7)
    : new URL(req.url).searchParams.get("token");
  return !!provided && provided === token;
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: NextRequest) {
  const token = process.env.EXPORT_TOKEN;
  if (!token) return new Response("Export disabled (set EXPORT_TOKEN)", { status: 503 });
  if (!isAuthed(req, token)) return new Response("Unauthorized", { status: 401 });

  const format = new URL(req.url).searchParams.get("format") ?? "json";

  let subs: Submission[];
  let voices: VoiceAnswer[];
  try {
    const db = await getDb();
    subs = await db.select().from(schema.submissions).orderBy(desc(schema.submissions.createdAt));
    voices = await db.select().from(schema.voiceAnswers);
  } catch (e) {
    console.error("export db error:", e);
    const err = e as { message?: string; cause?: { message?: string } };
    return Response.json(
      { error: "Could not read submissions", cause: err?.cause?.message ?? err?.message ?? String(e) },
      { status: 500 },
    );
  }

  const bySub = new Map<string, VoiceAnswer[]>();
  for (const v of voices) {
    const arr = bySub.get(v.submissionId) ?? [];
    arr.push(v);
    bySub.set(v.submissionId, arr);
  }

  if (format === "csv") {
    const qkeys = ALL_QUESTIONS.map((q) => q.key);
    const header = ["submission_id", "created_at", "submitted_at", ...qkeys, "voice_clips"];
    const lines = [header.map(csvCell).join(",")];
    for (const s of subs) {
      const ans = (s.answers ?? {}) as Record<string, string | string[]>;
      const row: unknown[] = [s.id, s.createdAt?.toISOString?.() ?? "", s.submittedAt?.toISOString?.() ?? ""];
      for (const k of qkeys) {
        const val = ans[k];
        row.push(Array.isArray(val) ? val.join("; ") : (val ?? ""));
      }
      row.push((bySub.get(s.id) ?? []).map((v) => `${v.questionKey}:${v.transcriptStatus}`).join("; "));
      lines.push(row.map(csvCell).join(","));
    }
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="feedback.csv"',
      },
    });
  }

  const submissions = await Promise.all(
    subs.map(async (s) => ({
      ...s,
      voice: await Promise.all(
        (bySub.get(s.id) ?? []).map(async (v) => ({
          questionKey: v.questionKey,
          transcript: v.transcript,
          status: v.transcriptStatus,
          durationSec: v.durationSec,
          audioUrl: await getDownloadUrl(v.objectKey),
        })),
      ),
    })),
  );
  return Response.json({ count: submissions.length, submissions });
}
