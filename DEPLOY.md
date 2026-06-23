# Deploy runbook

Architecture: **Netlify** runs the Next.js web tier (form + API routes). **Your
own box** runs Postgres + MinIO (S3-compatible storage) + the self-hosted Whisper
worker. Audio uploads go **browser → MinIO directly** via presigned URLs (so they
never hit Netlify's ~6 MB function limit).

```
 Student ──presign──▶ Netlify (/api/uploads/presign, /api/submit)
        ──PUT clip──▶ MinIO (your box)
                       Netlify ──▶ Postgres (your box): submission + voice rows (pending)
 Whisper worker (your box) ──poll pending──▶ transcribe ──▶ Postgres
 GTM team ──Bearer token──▶ Netlify /api/export (CSV/JSON + audio links + transcripts)
```

## 1. Bring up your infra box
On a small VPS with Docker installed (or locally once Docker Desktop is on):

```bash
cp .env.example .env          # set POSTGRES_PASSWORD, S3_ACCESS_KEY_ID/SECRET, S3_BUCKET, WHISPER_MODEL
docker compose up -d          # postgres + minio + worker (first worker run downloads the model)
```

Make Postgres (5432) and MinIO (9000) reachable from Netlify — ideally behind
TLS on your domain (e.g. `db.yourdomain.com`, `storage.yourdomain.com`) via a
reverse proxy. Lock the firewall to what you need.

## 2. Migrate the database
From your machine, pointed at the box's Postgres:
```bash
DATABASE_URL='postgres://feedback:<pw>@<host>:5432/feedback' npm run db:migrate
```

## 3. Configure storage CORS
The browser PUTs clips straight to MinIO, so allow your site origin:
- Allowed origins: `https://<your-netlify-site>` (and your custom domain)
- Allowed methods: `PUT`
- Allowed headers: `Content-Type`
(MinIO: `mc admin config` / bucket CORS; R2/S3: bucket CORS policy.)

## 4. Deploy the web tier to Netlify
Connect the repo in the Netlify UI (or `netlify deploy --build --prod`). Set
**Site → Environment variables**:

| Var | Value |
|---|---|
| `DATABASE_URL` | `postgres://feedback:<pw>@<host>:5432/feedback` |
| `S3_ENDPOINT` | internal storage URL (server-side, e.g. `https://storage.yourdomain.com`) |
| `NEXT_PUBLIC_S3_PUBLIC_ENDPOINT` | browser-facing storage origin (for CSP) |
| `S3_BUCKET` / `S3_REGION` | bucket + region |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | storage keys |
| `S3_FORCE_PATH_STYLE` | `true` (MinIO) |
| `NEXT_PUBLIC_SUBMIT_MODE` | `api` |
| `IP_HASH_SALT` | long random string |
| `EXPORT_TOKEN` | long random string (enables `/api/export`) |

`netlify.toml` already pins the build + Next adapter. Netlify serves HTTPS, so
the microphone works on every device (phones/Chromebooks included).

## 5. Smoke test
- Open the site, submit with a voice clip → thank-you screen.
- `curl -H "Authorization: Bearer $EXPORT_TOKEN" https://<site>/api/export?format=json`
  → your submission appears; its clip shows `status: pending`, then `done` once
  the worker transcribes it.

## 6. Before real students use it (privacy / DPDP)
- Add a consent/notice line and confirm your parental-consent stance.
- Set a **retention policy** (recommended: delete raw audio N days after
  transcription; keep transcripts). Add a scheduled job for it.
- Decide a per-IP submit cap (currently 20/min) and whether duplicate admission
  numbers are de-duped at analysis time (they're allowed at write time).
