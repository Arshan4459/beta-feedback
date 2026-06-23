// Drizzle schema (Postgres dialect). Used with real Postgres in production and
// in-process PGlite for local dev — identical schema, driver chosen at runtime.

import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const submissions = pgTable(
  "submissions",
  {
    // Client-generated UUID, also used as the idempotency key + storage folder.
    id: uuid("id").primaryKey(),
    admissionNo: text("admission_no").notNull(),
    grade: text("grade"),
    device: text("device"),
    overallKeep: text("overall_keep"),
    // Full visible-answers payload as submitted (source of truth).
    answers: jsonb("answers").notNull(),
    // Question keys that have a voice clip.
    voiceAnswers: jsonb("voice_answers").$type<string[]>().default([]),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("submissions_admission_idx").on(t.admissionNo),
    index("submissions_created_idx").on(t.createdAt),
  ],
);

export type TranscriptStatus = "pending" | "processing" | "done" | "failed";

// One row per recorded clip. Doubles as the transcription job queue
// (the worker claims rows where transcript_status = 'pending').
export const voiceAnswers = pgTable(
  "voice_answers",
  {
    id: uuid("id").primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    questionKey: text("question_key").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type"),
    bytes: integer("bytes"),
    durationSec: integer("duration_sec"),
    transcript: text("transcript"),
    transcriptStatus: text("transcript_status").$type<TranscriptStatus>().notNull().default("pending"),
    transcriptLang: text("transcript_lang"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    transcribedAt: timestamp("transcribed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("voice_answers_status_idx").on(t.transcriptStatus),
    index("voice_answers_submission_idx").on(t.submissionId),
  ],
);

export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type VoiceAnswer = typeof voiceAnswers.$inferSelect;
export type NewVoiceAnswer = typeof voiceAnswers.$inferInsert;
