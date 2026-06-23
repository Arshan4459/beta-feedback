// Server-only API helpers: request parsing, schema-aware validation, IP hashing,
// and a lightweight rate limiter. Never import this from a client component.

import { createHash } from "node:crypto";
import { z } from "zod";
import { ALL_QUESTIONS } from "./schema";
import { Answers, isAnswered, isVisible } from "./form";
import { ALLOWED_EXT } from "./storage";

const byKey = new Map(ALL_QUESTIONS.map((q) => [q.key, q]));
const TEXT_MAX = 5000;

// ---- request schemas ----
const fileSchema = z.object({
  questionKey: z.string().regex(/^[a-z0-9_]+$/),
  contentType: z.string().startsWith("audio/"),
  ext: z.enum([...ALLOWED_EXT] as [string, ...string[]]),
});

export const presignSchema = z.object({
  submissionId: z.string().uuid(),
  files: z.array(fileSchema).max(40),
});

const clipSchema = z.object({
  questionKey: z.string().regex(/^[a-z0-9_]+$/),
  objectKey: z.string().max(200),
  contentType: z.string().startsWith("audio/").optional(),
  bytes: z.number().int().nonnegative().optional(),
  durationSec: z.number().int().nonnegative().optional(),
});

export const submitSchema = z.object({
  submissionId: z.string().uuid(),
  submittedAt: z.string().datetime().optional(),
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  clips: z.array(clipSchema).max(40).default([]),
});

export type SubmitInput = z.infer<typeof submitSchema>;

/** Clean + validate answers against the question schema: drop unknown keys,
 *  reject invalid option values, drop hidden answers, require visible-required. */
export function validateAnswers(raw: Record<string, string | string[]>): {
  ok: boolean;
  errors: string[];
  clean: Answers;
} {
  const clean: Answers = {};
  for (const [k, v] of Object.entries(raw)) {
    const q = byKey.get(k);
    if (!q) continue; // drop unknown keys
    if (q.type === "multi" && Array.isArray(v)) {
      const allowed = new Set(q.options?.map((o) => o.value));
      const vals = v.filter((x) => typeof x === "string" && allowed.has(x));
      if (vals.length) clean[k] = vals;
    } else if (typeof v === "string") {
      if (q.type === "single") {
        if (q.options?.some((o) => o.value === v)) clean[k] = v;
      } else if (q.type === "scale") {
        if (["1", "2", "3", "4", "5"].includes(v)) clean[k] = v;
      } else if (q.type === "text" || q.type === "longtext") {
        const t = v.trim();
        if (t) clean[k] = t.slice(0, TEXT_MAX);
      }
    }
  }
  // Drop answers for questions that aren't visible given the (gate) answers.
  for (const q of ALL_QUESTIONS) {
    if (clean[q.key] !== undefined && !isVisible(q, clean)) delete clean[q.key];
  }
  const missing = ALL_QUESTIONS.filter(
    (q) => q.required && isVisible(q, clean) && !isAnswered(q, clean),
  ).map((q) => q.key);
  const errors = missing.length ? [`missing required: ${missing.join(", ")}`] : [];
  return { ok: errors.length === 0, errors, clean };
}

/** Keep only clips whose question is a known, visible, recordable leaf and whose
 *  object key belongs to this submission. */
export function validateClips(
  clips: SubmitInput["clips"],
  submissionId: string,
  answers: Answers,
) {
  const prefix = `submissions/${submissionId}/`;
  return clips.filter((c) => {
    const q = byKey.get(c.questionKey);
    return q && !q.noRecord && isVisible(q, answers) && c.objectKey.startsWith(prefix);
  });
}

// ---- IP + rate limit ----
const SALT = process.env.IP_HASH_SALT ?? "beta-feedback-dev-salt";

export function hashIp(ip: string): string {
  return createHash("sha256").update(`${SALT}:${ip}`).digest("hex").slice(0, 32);
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-nf-client-connection-ip") ??
    "unknown"
  );
}

// In-memory sliding window. Per-instance only — fine at this volume; for
// multi-instance hardening, back this with the DB or an external store.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  }
  return arr.length <= limit;
}
