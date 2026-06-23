# Beta Student Feedback Form

A dynamic, branching feedback questionnaire for K-12 beta students, built with
Next.js (App Router) + TypeScript. Covers **Tests, Schedule, Learn, ASTRA** and
an overall block. Every non-text question can be answered by tapping/typing **or**
by recording a short voice clip.

Full stack: form UI, presigned audio uploads, persistence, self-hosted Whisper
transcription, and an authenticated export. With **nothing configured it runs
fully locally** — in-process Postgres (PGlite) + local-disk storage — so you can
develop and test the real pipeline with zero infra. Production swaps in real
Postgres + S3-compatible storage via env vars. See [DEPLOY.md](DEPLOY.md).

## Run locally

```bash
npm install
npm run db:migrate           # set up the local PGlite database
cp .env.example .env.local   # optional; defaults to local "api" mode
npm run dev                  # http://localhost:3000
```

- **Test mode** (default, `NEXT_PUBLIC_SUBMIT_ENDPOINT` blank): submitting
  downloads a `feedback-response.json` with answers + voice clips embedded as
  base64 data URLs. Lets you exercise the whole flow before the backend exists.
- **Endpoint mode**: set `NEXT_PUBLIC_SUBMIT_ENDPOINT` to your API URL.
  Submission is a single `multipart/form-data` POST — a JSON `answers` field
  plus one audio file per recorded question (`audio_<question_key>.<ext>`), with
  an `Idempotency-Key` header.

Microphone capture needs a secure context (HTTPS or `localhost`). On plain
`http://`, recording is blocked and the form degrades gracefully to tap/type.

## How it's built

| Concern | Where |
|---|---|
| All questions, options, copy, branching | `lib/schema.ts` (single source of truth) |
| Visibility / progress / validation logic | `lib/form.ts` (pure functions) |
| Client submission (api / endpoint / download) | `lib/submit.ts` |
| Form orchestration (state, branching, submit) | `components/FeedbackForm.tsx` |
| Question renderers + voice recorder | `components/Question.tsx`, `components/VoiceRecorder.tsx` |
| DB schema + driver (Postgres / PGlite) | `lib/db/` |
| Object storage (S3 presign / local disk) | `lib/storage.ts` |
| API: presign, submit, export | `app/api/{uploads/presign,submit,export}/route.ts` |
| Server validation, rate limit, IP hashing | `lib/api.ts` |
| Self-hosted Whisper worker | `worker/` (Docker, runs on your box) |

Add, remove, or reorder a question by editing `lib/schema.ts` — rendering,
branching, progress, validation, and the payload all follow automatically.

### Conditional branching
Each feature section opens with a required "Did you use…?" gate; its follow-ups
appear only when relevant. Hidden questions are never validated and never
submitted. Branching is declarative: a question lists `visibleWhen` conditions
(AND-ed), which also expresses nested gates (e.g. Learn → "Some things didn't
work" → "Which part didn't work well?").

## Status
Built & verified locally: form, presigned uploads, `/api/submit` (validate +
persist + enqueue, idempotent), authenticated CSV/JSON export, security headers.
The Whisper worker (`worker/`) is built but validated on the deploy box (needs
ffmpeg/model). Deploy steps: [DEPLOY.md](DEPLOY.md).
