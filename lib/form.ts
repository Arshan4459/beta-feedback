// Pure form-logic helpers shared by the renderer. No React, no DOM — easy to unit test.

import { ALL_QUESTIONS, Question } from "./schema";

/** Answer values: choices/scale/text are strings, multi-select is a string[]. */
export type AnswerValue = string | string[];
export type Answers = Record<string, AnswerValue>;

/** A question is visible when every one of its conditions matches the current answers. */
export function isVisible(q: Question, answers: Answers): boolean {
  if (!q.visibleWhen) return true;
  return q.visibleWhen.every((c) => answers[c.key] === c.equals);
}

/** Whether a question currently holds a usable answer. */
export function isAnswered(q: Question, answers: Answers): boolean {
  const v = answers[q.key];
  if (q.type === "multi") return Array.isArray(v) && v.length > 0;
  return typeof v === "string" && v.trim() !== "";
}

/** Percent of currently-visible questions that have an answer (0–100). */
export function computeProgress(answers: Answers): number {
  const visible = ALL_QUESTIONS.filter((q) => isVisible(q, answers));
  if (visible.length === 0) return 0;
  const answered = visible.filter((q) => isAnswered(q, answers)).length;
  return Math.round((answered / visible.length) * 100);
}

/** Keys of required, visible questions that are still unanswered. */
export function findInvalid(answers: Answers): string[] {
  return ALL_QUESTIONS.filter(
    (q) => q.required && isVisible(q, answers) && !isAnswered(q, answers),
  ).map((q) => q.key);
}

/** Build the answers payload: only visible questions, omitting empty values.
 *  Mirrors the prototype contract — hidden (unused-section) fields are dropped. */
export function collectAnswers(answers: Answers): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  for (const q of ALL_QUESTIONS) {
    if (!isVisible(q, answers)) continue;
    const v = answers[q.key];
    if (q.type === "multi") {
      if (Array.isArray(v) && v.length > 0) out[q.key] = v;
    } else if (typeof v === "string" && v.trim() !== "") {
      out[q.key] = v;
    }
  }
  return out;
}
