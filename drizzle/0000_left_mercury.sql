CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"admission_no" text NOT NULL,
	"grade" text,
	"device" text,
	"overall_keep" text,
	"answers" jsonb NOT NULL,
	"voice_answers" jsonb DEFAULT '[]'::jsonb,
	"submitted_at" timestamp with time zone,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_answers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"submission_id" uuid NOT NULL,
	"question_key" text NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text,
	"bytes" integer,
	"duration_sec" integer,
	"transcript" text,
	"transcript_status" text DEFAULT 'pending' NOT NULL,
	"transcript_lang" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"transcribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "voice_answers" ADD CONSTRAINT "voice_answers_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submissions_admission_idx" ON "submissions" USING btree ("admission_no");--> statement-breakpoint
CREATE INDEX "submissions_created_idx" ON "submissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "voice_answers_status_idx" ON "voice_answers" USING btree ("transcript_status");--> statement-breakpoint
CREATE INDEX "voice_answers_submission_idx" ON "voice_answers" USING btree ("submission_id");