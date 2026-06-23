"use client";

import { useEffect, useRef, useState } from "react";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

type StatusKind = "default" | "saved" | "error";

export default function VoiceRecorder({
  questionKey,
  maxSeconds,
  onClipChange,
}: {
  questionKey: string;
  maxSeconds: number;
  onClipChange: (key: string, blob: Blob | null) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [statusKind, setStatusKind] = useState<StatusKind>("default");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secsRef = useRef(0);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Clean up the mic, timer, and object URL if the component goes away mid-recording.
  useEffect(() => {
    return () => {
      stopTimer();
      releaseStream();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  async function start() {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof MediaRecorder === "undefined"
    ) {
      setStatusKind("error");
      setStatusText("Recording isn't supported on this browser. You can still tap or type your answer.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setStatusKind("error");
      setStatusText("Microphone is off. Please allow mic access and try again.");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    // webm/opus where supported (Chrome, Edge, Firefox, Android); Safari/iOS produce MP4/M4A.
    const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      onClipChange(questionKey, blob);
      setStatusKind("saved");
      setStatusText("Saved ✓");
      releaseStream();
      stopTimer();
      secsRef.current = 0;
      setRecording(false);
    };

    recorder.start();
    setRecording(true);
    secsRef.current = 0;
    setStatusKind("default");
    setStatusText("Recording… 0:00");
    timerRef.current = setInterval(() => {
      secsRef.current += 1;
      setStatusText("Recording… " + fmt(secsRef.current));
      if (secsRef.current >= maxSeconds) recorderRef.current?.stop(); // auto-stop at the cap
    }, 1000);
  }

  function handleButton() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    void start();
  }

  function handleDelete() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    onClipChange(questionKey, null);
    setStatusKind("default");
    setStatusText("");
  }

  const statusClass =
    "rec-status" + (statusKind === "saved" ? " saved" : statusKind === "error" ? " error" : "");

  return (
    <div className="rec">
      <button
        type="button"
        className={"rec-btn" + (recording ? " recording" : "")}
        onClick={handleButton}
        aria-pressed={recording}
      >
        <span aria-hidden="true">{recording ? "⏹️" : "🎤"}</span>
        <span>{recording ? "Stop" : "Record answer"}</span>
      </button>

      <span className={statusClass} aria-live="polite" role="status">
        {statusText}
      </span>

      {audioUrl && (
        <span className="rec-player">
          <audio controls src={audioUrl} />
          <button
            type="button"
            className="rec-del"
            title="Delete recording"
            aria-label="Delete recording"
            onClick={handleDelete}
          >
            🗑️
          </button>
        </span>
      )}
    </div>
  );
}
