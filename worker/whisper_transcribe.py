#!/usr/bin/env python3
"""Transcribe one audio file with faster-whisper. Prints {"text", "language"} as JSON.

Usage: python3 whisper_transcribe.py <audio_file> [model_size]

Note: this loads the model per invocation (simple, fine for low volume). For
high throughput, convert this into a resident process that reads file paths from
stdin so the model is loaded once.
"""
import json
import sys

from faster_whisper import WhisperModel


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: whisper_transcribe.py <file> [model]"}))
        return 2
    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "base"

    # CPU-friendly defaults; override with WHISPER_DEVICE / WHISPER_COMPUTE if needed.
    import os
    device = os.environ.get("WHISPER_DEVICE", "cpu")
    compute = os.environ.get("WHISPER_COMPUTE", "int8")

    # Bias the model toward this product's vocabulary so proper nouns (esp.
    # "ASTRA") transcribe correctly instead of "Astro"/"astra".
    prompt = os.environ.get(
        "WHISPER_PROMPT",
        "Student feedback about a learning app with features named Tests, "
        "Schedule, Learn, and ASTRA (the question helper).",
    )

    model = WhisperModel(model_size, device=device, compute_type=compute)
    segments, info = model.transcribe(
        audio_path, beam_size=1, vad_filter=True, initial_prompt=prompt
    )
    text = " ".join(seg.text.strip() for seg in segments).strip()
    print(json.dumps({"text": text, "language": info.language}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
