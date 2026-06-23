// Client-side submission. Three modes (see lib/config.ts):
//   api      -> presigned upload of each clip + POST /api/submit (our backend)
//   endpoint -> single legacy multipart POST to an external endpoint
//   download -> test mode: download a JSON file with clips as base64 data URLs

import { Answers, collectAnswers } from "./form";
import { SUBMIT_ENDPOINT, SUBMIT_MODE } from "./config";

export interface VoiceClip {
  key: string;
  blob: Blob;
}

export interface SubmitArgs {
  submissionId: string;
  submittedAt: string;
  answers: Answers;
  clips: VoiceClip[];
}

/** Pick a filename/extension from a recorded blob's MIME type. */
export function audioExt(type: string): string {
  if (type.includes("webm")) return "webm";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mp4") || type.includes("mpeg") || type.includes("m4a") || type.includes("aac"))
    return "m4a";
  return "bin";
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error ?? new Error("Could not read audio clip"));
    fr.readAsDataURL(blob);
  });
}

import { ALL_QUESTIONS } from "./schema";
import { isVisible } from "./form";

/** Keep only clips whose question is still visible (hidden sections excluded). */
export function visibleClips(clips: Map<string, Blob>, answers: Answers): VoiceClip[] {
  const out: VoiceClip[] = [];
  for (const [key, blob] of clips) {
    const q = ALL_QUESTIONS.find((x) => x.key === key);
    if (q && isVisible(q, answers)) out.push({ key, blob });
  }
  return out;
}

export async function submitFeedback(args: SubmitArgs): Promise<void> {
  if (SUBMIT_MODE === "api") return submitViaApi(args);
  if (SUBMIT_MODE === "endpoint") return submitViaEndpoint(args);
  return downloadSubmission(args);
}

interface UploadTarget {
  questionKey: string;
  objectKey: string;
  uploadUrl: string;
  method: string;
  headers: Record<string, string>;
}

// --- api mode: presign -> upload clips -> submit metadata ---
async function submitViaApi({ submissionId, submittedAt, answers, clips }: SubmitArgs) {
  let targets: UploadTarget[] = [];
  if (clips.length > 0) {
    const files = clips.map((c) => ({
      questionKey: c.key,
      contentType: c.blob.type || "audio/webm",
      ext: audioExt(c.blob.type),
    }));
    const res = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, files }),
    });
    if (!res.ok) throw new Error(`presign failed (${res.status})`);
    targets = (await res.json()).targets ?? [];
  }

  const byKey = new Map(targets.map((t) => [t.questionKey, t]));
  const uploaded: Array<{ questionKey: string; objectKey: string; contentType?: string; bytes: number }> = [];
  for (const c of clips) {
    const t = byKey.get(c.key);
    if (!t) continue;
    const up = await fetch(t.uploadUrl, { method: t.method, headers: t.headers, body: c.blob });
    if (!up.ok) throw new Error(`upload failed (${up.status})`);
    uploaded.push({
      questionKey: c.key,
      objectKey: t.objectKey,
      contentType: c.blob.type || undefined,
      bytes: c.blob.size,
    });
  }

  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": submissionId },
    body: JSON.stringify({ submissionId, submittedAt, answers: collectAnswers(answers), clips: uploaded }),
  });
  if (!res.ok) throw new Error(`submit failed (${res.status})`);
}

/** Flat payload used by endpoint + download modes. */
function flatPayload({ submissionId, submittedAt, answers, clips }: SubmitArgs) {
  return {
    submittedAt,
    idempotencyKey: submissionId,
    voiceAnswers: clips.map((c) => c.key),
    ...collectAnswers(answers),
  };
}

// --- endpoint mode: legacy single multipart POST ---
async function submitViaEndpoint(args: SubmitArgs) {
  const payload = flatPayload(args);
  const fd = new FormData();
  fd.append("answers", JSON.stringify(payload));
  for (const c of args.clips) {
    fd.append(`audio_${c.key}`, c.blob, `${c.key}.${audioExt(c.blob.type)}`);
  }
  const res = await fetch(SUBMIT_ENDPOINT, {
    method: "POST",
    body: fd,
    headers: { "Idempotency-Key": args.submissionId },
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
}

// --- download mode: test before any backend ---
async function downloadSubmission(args: SubmitArgs) {
  const payload: Record<string, unknown> = flatPayload(args);
  for (const c of args.clips) {
    payload[`audio_${c.key}`] = await blobToDataURL(c.blob);
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "feedback-response.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
