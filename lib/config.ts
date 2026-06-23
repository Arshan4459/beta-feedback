// Client-readable runtime configuration (must keep NEXT_PUBLIC_ prefix).
//
//   NEXT_PUBLIC_MAX_SECONDS    Per-clip recording cap in seconds (default 120).
//   NEXT_PUBLIC_SUBMIT_MODE    "api" | "endpoint" | "download"
//                                api      -> presigned upload + POST /api/submit (our backend)
//                                endpoint -> legacy multipart POST to NEXT_PUBLIC_SUBMIT_ENDPOINT
//                                download -> test mode, downloads a JSON file
//                              Defaults to "endpoint" if SUBMIT_ENDPOINT is set, else "api".
//   NEXT_PUBLIC_SUBMIT_ENDPOINT  External endpoint URL for "endpoint" mode.

export const SUBMIT_ENDPOINT = process.env.NEXT_PUBLIC_SUBMIT_ENDPOINT ?? "";

export const MAX_SECONDS = Number(process.env.NEXT_PUBLIC_MAX_SECONDS ?? "120") || 120;

export type SubmitMode = "api" | "endpoint" | "download";

export const SUBMIT_MODE: SubmitMode =
  (process.env.NEXT_PUBLIC_SUBMIT_MODE as SubmitMode) || (SUBMIT_ENDPOINT ? "endpoint" : "api");
