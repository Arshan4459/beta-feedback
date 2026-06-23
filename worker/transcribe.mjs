// Self-hosted Whisper transcription worker (standalone service — runs on your
// box, separate from the Netlify web tier). Polls voice_answers for pending
// clips, claims one with FOR UPDATE SKIP LOCKED, downloads the audio from
// storage, transcribes it via faster-whisper, and writes the transcript back.
//
// Env: DATABASE_URL (required), plus storage env (S3_* or LOCAL_STORAGE_DIR),
//      WHISPER_MODEL (default "base"), PYTHON_BIN (default "python3"),
//      POLL_MS (default 3000), MAX_ATTEMPTS (default 3).

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";

const POLL_MS = Number(process.env.POLL_MS ?? "3000");
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS ?? "3");
const MODEL = process.env.WHISPER_MODEL ?? "base";
const PYTHON = process.env.PYTHON_BIN ?? "python3";
const WHISPER_SCRIPT = path.join(import.meta.dirname, "whisper_transcribe.py");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for the transcription worker");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
});

let running = true;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Atomically claim one pending clip and mark it 'processing'. */
async function claimJob() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT id, object_key, attempts FROM voice_answers
       WHERE transcript_status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1 FOR UPDATE SKIP LOCKED`,
    );
    if (rows.length === 0) {
      await client.query("COMMIT");
      return null;
    }
    const job = rows[0];
    await client.query(
      `UPDATE voice_answers SET transcript_status='processing', attempts=attempts+1 WHERE id=$1`,
      [job.id],
    );
    await client.query("COMMIT");
    return job;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function fetchAudio(objectKey) {
  if (process.env.S3_BUCKET) {
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({
      region: process.env.S3_REGION ?? "us-east-1",
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    });
    const res = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: objectKey }));
    return Buffer.from(await res.Body.transformToByteArray());
  }
  const dir = process.env.LOCAL_STORAGE_DIR ?? "./.uploads";
  return readFile(path.resolve(dir, objectKey));
}

function transcribe(filePath) {
  return new Promise((resolve, reject) => {
    const py = spawn(PYTHON, [WHISPER_SCRIPT, filePath, MODEL]);
    let out = "";
    let err = "";
    py.stdout.on("data", (d) => (out += d));
    py.stderr.on("data", (d) => (err += d));
    py.on("error", reject);
    py.on("close", (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(out));
        } catch {
          reject(new Error(`bad transcriber output: ${out.slice(0, 200)}`));
        }
      } else {
        reject(new Error(err.slice(0, 500) || `transcriber exited ${code}`));
      }
    });
  });
}

async function processJob(job) {
  const ext = job.object_key.split(".").pop() || "webm";
  const tmp = await mkdtemp(path.join(tmpdir(), "clip-"));
  const file = path.join(tmp, `audio.${ext}`);
  try {
    await writeFile(file, await fetchAudio(job.object_key));
    const { text, language } = await transcribe(file);
    await pool.query(
      `UPDATE voice_answers
       SET transcript=$1, transcript_lang=$2, transcript_status='done', transcribed_at=now(), error=NULL
       WHERE id=$3`,
      [text, language ?? null, job.id],
    );
    console.log(`✓ ${job.id} (${(text ?? "").length} chars)`);
  } catch (e) {
    const failed = job.attempts + 1 >= MAX_ATTEMPTS;
    await pool.query(
      `UPDATE voice_answers SET transcript_status=$1, error=$2 WHERE id=$3`,
      [failed ? "failed" : "pending", String(e?.message ?? e).slice(0, 500), job.id],
    );
    console.error(`✗ ${job.id} (${failed ? "failed" : "will retry"}): ${e?.message ?? e}`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function loop() {
  console.log(`transcription worker up (model=${MODEL}, poll=${POLL_MS}ms)`);
  while (running) {
    try {
      const job = await claimJob();
      if (job) await processJob(job);
      else await sleep(POLL_MS);
    } catch (e) {
      console.error("worker loop error:", e?.message ?? e);
      await sleep(POLL_MS);
    }
  }
  await pool.end();
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`\n${sig} — shutting down…`);
    running = false;
  });
}

loop();
