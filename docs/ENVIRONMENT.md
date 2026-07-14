# Nexus — Environment & Credentials Checklist

Sorted by what actually blocks the build. Fill in Tier 1 first; Tier 2 before the full pipeline; skip the rest for v1.

---

## Deploy: run TWO processes, not one

The backend is a web process **and** a worker process — both must run:

- `uvicorn app.main:app` — the API (enqueues jobs).
- `python -m app.worker` — the queue worker (drains them: handoff build on plan
  approval, compile + Phase-6 fan-out + snapshot render on interview completion).

The Dockerfile / hosting setup must start both (two services, or a process manager). A
web-only deploy fails silently at the payoff moment: interviews complete but no report
is ever generated. Rehearsal finding — the failure mode is "a queue nobody drains,"
with no error, just a missing artifact.

---

## Tier 1 — Blocking (demo path cannot start/finish without these)

| # | Service | What I need | How I use it | Notes |
|---|---|---|---|---|
| 1 | **Anthropic API** ⚠️ missing from your draft | API key | SDK (no CLI/MCP needed) | The reasoning engine for every demanding seat (compiler, interviewer, plan generation). Set a spend cap in console. This is the single most important key. |
| 2 | **OpenAI API** | API key | SDK | Embeddings only (`text-embedding-3-small`) — keeps Tunç's pgvector dimensions compatible. Not used for reasoning. |
| 3 | **VAPI** | API key + **public key** (web SDK) + org ID | Dashboard + API; MCP exists, CLI exists — **we use the API + dashboard; MCP optional for me to manage assistants directly** | Web-call demo needs NO phone number. I need: assistant created via API, webhook pointed at our backend (see "non-key items"). Choose a voice in dashboard (VAPI bundles ElevenLabs/PlayHT voices — no separate ElevenLabs account needed). |
| 4 | **Supabase** | Just say yes + org choice | **MCP already connected to me** — I can create the project, run migrations, manage keys myself (you'll confirm cost) | Answer to your "supabase?" — **yes**: it's our Postgres + pgvector + auth host. Region: pick `eu-central-1` (Istanbul clients). |
| 5 | **Firecrawl** | API key | SDK (Tunç's wrapper carries over) | Stage 1 website/company scrape. |
| 6 | **Email sender** | SendGrid API key (backend already integrated) **or** Resend | SDK | Interview invites. See DNS item below — the key alone is not enough. |

## Tier 2 — Full pipeline & deploy (needed this week, not hour one)

| # | Service | What I need | How I use it | Notes |
|---|---|---|---|---|
| 7 | **Apify** | API token + confirm LinkedIn-people actor budget | SDK/HTTP | Stage 1 people scrape. Names + roles only (policy F4). |
| 8 | **Fireflies** | API key | HTTP API (my MCP covers interactive; backend needs its own key for auto-ingest) | CEO-call transcript ingestion into Stage 4. |
| 8b | **Twelve Labs** | API key (`TWELVELABS_API_KEY`) | HTTP API | Mid-interview screen/video extract. Screenshots/files use Anthropic vision. Also needs Supabase **service role** + private Storage bucket `media-shares` (raw blobs retained). Setup guide: [`docs/SUPABASE-MEDIA-SHARES-SETUP.md`](SUPABASE-MEDIA-SHARES-SETUP.md). Tests use `MEDIA_STORAGE_BACKEND=memory`. |
| 9 | **Vercel** | Account + team, then `vercel login` on this machine or a token | **CLI** (`vercel`) | Frontend deploy. |
| 10 | **Railway** | Token or `railway login` | **CLI** (`railway`) | FastAPI backend + queue worker deploy. (Postgres itself lives on Supabase, so Railway only runs the app processes.) |
| 11 | **GitHub** | Nothing — `gh` already authed | CLI | I'll create the fresh `nexus` repo under your account when you say go. |

## Not only API keys — the physical/config items

- **A domain** (even a cheap one): needed for ① the app URL, ② VAPI webhook over TLS, ③ email deliverability. Give me DNS access or be ready to paste records.
- **Email domain verification**: SPF + DKIM records for SendGrid/Resend — without this, every interview invite lands in spam and the product dies at hello.
- **VAPI webhook target**: a publicly reachable backend URL. Deploy-first solves it; for local development I'll run a `cloudflared` tunnel (no account needed) — nothing for you to buy.
- **Anthropic + OpenAI spend caps** set in their consoles (protects against runaway eval loops).
- **A test interviewee**: one real email + phone you control, for end-to-end invite → voice call testing.
- **Supabase org confirmation**: which org I create the project under, and OK on the ~$10–25/mo tier.

## API auth env (P0-1 — the admin gate; see FOR-TUNC #21)

The backend now verifies every admin request's Supabase JWT, so these must be set in the deploy environment:

- **Backend (Railway):** `SUPABASE_URL` (already set) **+ `SUPABASE_ANON_KEY`** — the anon/publishable key, sent as the `apikey` header when verifying a caller's token against GoTrue. Same value the frontend already uses; it just needs to reach the API process too.
- **Frontend (Vercel):** `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (already set for login) — the browser attaches the admin's session token to every API call from these.
- **Eval harness (local/CI only):** `NEXUS_ADMIN_EMAIL` / `NEXUS_ADMIN_PASSWORD` — a real admin login (provisioned by `backend/scripts/create_admin.py`). The harness does a genuine GoTrue password grant; **never commit these** (export them or add to the gitignored `.env`).

## Skip for v1 (deliberate)

- **Kimi 2.5** — adds a second reasoning vendor with no unique advantage here; the cheap tier is better served by a small Anthropic model, one SDK fewer. Cut it.
- **LiveKit** — superseded by the VAPI decision.
- **Hume / prosody analysis** — phase 2 by your own call decision.
- **Standalone ElevenLabs** — VAPI bundles TTS.
- **Qualtrics** — v1 architecture artifact, dead since the agent-interview pivot.
