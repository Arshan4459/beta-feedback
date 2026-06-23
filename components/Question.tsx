"use client";

import { PARENT_KEYS, Question } from "@/lib/schema";
import { AnswerValue } from "@/lib/form";
import VoiceRecorder from "./VoiceRecorder";

export default function QuestionView({
  question: q,
  value,
  onChange,
  onClipChange,
  hidden,
  invalid,
  maxSeconds,
}: {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (key: string, value: AnswerValue) => void;
  onClipChange: (key: string, blob: Blob | null) => void;
  hidden: boolean;
  invalid: boolean;
  maxSeconds: number;
}) {
  const str = typeof value === "string" ? value : "";
  const arr = Array.isArray(value) ? value : [];

  return (
    <div className={"q" + (hidden ? " hidden" : "")} id={`q-${q.key}`}>
      <label className="qt" htmlFor={q.type === "text" || q.type === "longtext" ? q.key : undefined}>
        {q.label} {q.required && <span className="req">*</span>}
      </label>

      {q.type === "single" && (
        <div
          className={"opts" + (q.layout === "col" ? " col" : "") + (q.emoji ? " emoji" : "")}
          role="radiogroup"
          aria-label={q.label}
        >
          {q.options?.map((o) => {
            const id = `${q.key}_${o.value}`;
            return (
              <span className="opt" key={o.value}>
                <input
                  type="radio"
                  id={id}
                  name={q.key}
                  value={o.value}
                  checked={str === o.value}
                  onChange={() => onChange(q.key, o.value)}
                />
                <label htmlFor={id}>
                  {o.emoji && (
                    <span className="e" aria-hidden="true">
                      {o.emoji}
                    </span>
                  )}
                  {o.label}
                </label>
              </span>
            );
          })}
        </div>
      )}

      {q.type === "multi" && (
        <div className={"opts" + (q.layout === "col" ? " col" : "")}>
          {q.options?.map((o) => {
            const id = `${q.key}_${o.value}`;
            const checked = arr.includes(o.value);
            return (
              <span className="opt" key={o.value}>
                <input
                  type="checkbox"
                  id={id}
                  name={q.key}
                  value={o.value}
                  checked={checked}
                  onChange={(e) =>
                    onChange(
                      q.key,
                      e.target.checked ? [...arr, o.value] : arr.filter((v) => v !== o.value),
                    )
                  }
                />
                <label htmlFor={id}>{o.label}</label>
              </span>
            );
          })}
        </div>
      )}

      {q.type === "scale" && (
        <div className="scale">
          <span className="cap">{q.capLow}</span>
          <span className="nums" role="radiogroup" aria-label={q.label}>
            {[1, 2, 3, 4, 5].map((n) => {
              const v = String(n);
              const id = `${q.key}_${n}`;
              return (
                <span className="opt" key={n}>
                  <input
                    type="radio"
                    id={id}
                    name={q.key}
                    value={v}
                    checked={str === v}
                    onChange={() => onChange(q.key, v)}
                  />
                  <label htmlFor={id}>{n}</label>
                </span>
              );
            })}
          </span>
          <span className="cap high">{q.capHigh}</span>
        </div>
      )}

      {q.type === "text" && (
        <input
          type="text"
          id={q.key}
          name={q.key}
          className="textline"
          placeholder={q.placeholder}
          autoComplete="off"
          value={str}
          onChange={(e) => onChange(q.key, e.target.value)}
        />
      )}

      {q.type === "longtext" && (
        <textarea
          id={q.key}
          name={q.key}
          placeholder={q.placeholder}
          value={str}
          onChange={(e) => onChange(q.key, e.target.value)}
        />
      )}

      {invalid && <div className="err">{q.errorMsg ?? "Please pick one."}</div>}

      {!q.noRecord && !PARENT_KEYS.has(q.key) && (
        <VoiceRecorder questionKey={q.key} maxSeconds={maxSeconds} onClipChange={onClipChange} />
      )}
    </div>
  );
}
