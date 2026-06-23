"use client";

import { useMemo, useRef, useState } from "react";
import { SECTIONS } from "@/lib/schema";
import { MAX_SECONDS } from "@/lib/config";
import {
  AnswerValue,
  Answers,
  computeProgress,
  findInvalid,
  isVisible,
} from "@/lib/form";
import { submitFeedback, visibleClips } from "@/lib/submit";
import QuestionView from "./Question";

export default function FeedbackForm() {
  const [answers, setAnswers] = useState<Answers>({});
  const [invalidKeys, setInvalidKeys] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Voice clips live in a ref (don't trigger re-renders) keyed by question.
  const clipsRef = useRef<Map<string, Blob>>(new Map());
  const idRef = useRef<string | null>(null);

  const progress = useMemo(() => computeProgress(answers), [answers]);

  function handleChange(key: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setInvalidKeys((prev) => prev.filter((k) => k !== key));
    if (formError) setFormError(null);
  }

  function handleClipChange(key: string, blob: Blob | null) {
    if (blob) clipsRef.current.set(key, blob);
    else clipsRef.current.delete(key);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const invalid = findInvalid(answers);
    if (invalid.length > 0) {
      setInvalidKeys(invalid);
      document
        .getElementById(`q-${invalid[0]}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const clips = visibleClips(clipsRef.current, answers);
      if (!idRef.current) idRef.current = crypto.randomUUID();
      await submitFeedback({
        submissionId: idRef.current,
        submittedAt: new Date().toISOString(),
        answers,
        clips,
      });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setFormError("Sorry — we couldn't send your feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="thanks">
        <div className="big">🎉</div>
        <h2>Thank you!</h2>
        <p>Your feedback has been sent. It really helps us make the app better for everyone.</p>
      </div>
    );
  }

  return (
    <>
      <div className="progress" aria-hidden="true">
        <i style={{ width: `${progress}%` }} />
      </div>

      <form onSubmit={handleSubmit} noValidate autoComplete="off">
        {SECTIONS.map((section) => (
          <section className="card" key={section.id}>
            <h2>
              {section.title}
              {section.titleNote && <span className="titlenote"> {section.titleNote}</span>}
            </h2>
            {section.sub && <p className="sub">{section.sub}</p>}

            {section.questions.map((q) => {
              const visible = isVisible(q, answers);
              return (
                <QuestionView
                  key={q.key}
                  question={q}
                  value={answers[q.key]}
                  onChange={handleChange}
                  onClipChange={handleClipChange}
                  hidden={!visible}
                  invalid={visible && invalidKeys.includes(q.key)}
                  maxSeconds={MAX_SECONDS}
                />
              );
            })}
          </section>
        ))}

        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}

        <div className="actions">
          <button type="submit" className="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Submit my feedback ✅"}
          </button>
        </div>
      </form>
    </>
  );
}
