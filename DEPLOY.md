# Deploy runbook — all-in-one VPS

Everything runs on **one server** via `docker-compose.prod.yml`:

```
 Student ─HTTPS─▶ Caddy (auto TLS) ─▶ Next.js app ─▶ Postgres
                                          └─ writes clips to a shared disk volume
 Whisper worker ─poll pending─▶ reads the volume ─▶ transcribes ─▶ Postgres
 GTM team ─Bearer token─▶ /api/export  (CSV/JSON + audio + transcripts)
```

No MinIO, no external services: audio is stored on disk and read by the worker
over a shared Docker volume. Caddy gets a Let's Encrypt cert automatically.

## Prerequisites
- A small **VPS** — Ubuntu 22.04+, **≥ 2 GB RAM** (4 GB if using the `base`/`small`
  Whisper model), e.g. Hetzner CX22 (~€4/mo) or a $6 DigitalOcean droplet.
- A **domain** (or subdomain) you can point at the VPS — required for valid HTTPS,
  which the microphone needs.

## 1. Prepare the server
```bash
# install Docker
curl -fsSL https://get.docker.com | sh

# point your DNS A record (e.g. feedback.yourschool.com) at the VPS IP, then:
git clone https://github.com/Arshan4459/<repo>.git
cd <repo>
```

## 2. Configure
```bash
cp .env.example .env
```
Set in `.env`:
| Var | Value |
|---|---|
| `DOMAIN` | `feedback.yourschool.com` (matches your DNS) |
| `POSTGRES_PASSWORD` | a strong password |
| `IP_HASH_SALT` | a long random string |
| `EXPORT_TOKEN` | a long random string (enables `/api/export`) |
| `WHISPER_MODEL` | `base` (or `small` for better accuracy; `tiny` for low RAM) |

## 3. Launch
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Caddy obtains the TLS cert, the app runs DB migrations on startup, and the worker
downloads the Whisper model on first use. Open `https://<DOMAIN>` — done.

## 4. Smoke test
- Submit the form with a voice clip → thank-you screen.
- `curl -H "Authorization: Bearer $EXPORT_TOKEN" https://<DOMAIN>/api/export?format=json`
  → your submission appears; the clip flips from `pending` to `done` with a
  transcript within seconds (`docker compose -f docker-compose.prod.yml logs -f worker`).

## 5. Operate
- **Logs:** `docker compose -f docker-compose.prod.yml logs -f app worker`
- **Update:** `git pull && docker compose -f docker-compose.prod.yml up -d --build`
- **Backups:** the `pgdata` (database) and `uploads` (audio) volumes. Snapshot the
  VPS or `docker run --rm -v betafeedback_pgdata:/v alpine tar ...`.
- **Export for the GTM team:** `…/api/export?format=csv` (or `json`) with the
  `Authorization: Bearer <EXPORT_TOKEN>` header.

## 6. Before real students use it (privacy / DPDP)
- Add a consent/notice line and confirm your parental-consent stance.
- Set a **retention policy** (recommended: delete raw audio N days after
  transcription; keep transcripts). A cron + small SQL/`rm` job on the volume.
- Per-IP caps are in place (submit 20/min, upload 120/min); duplicate admission
  numbers are allowed at write time and can be de-duped at analysis.

---

### Alternative: Netlify + separate box
If you ever want the web tier on Netlify instead, the code supports it
(`NEXT_PUBLIC_SUBMIT_MODE=api`, `STORAGE_DRIVER=s3` with S3/MinIO + presigned
uploads). `netlify.toml` and `docker-compose.yml` (Postgres + MinIO + worker) are
kept for that path, but it needs HTTPS + CORS on the storage endpoint. The
all-in-one VPS above is simpler and recommended.
