# Supabase setup for mid-interview media shares

Interview Share (file / screenshot / screen) stores **raw bytes** in a private Supabase Storage bucket and **metadata + extraction text** in Postgres (`media_shares`). The API and worker read/write Storage with the **service role** key — never the anon/publishable key.

Prereqs already in `.env`:
- `SUPABASE_URL` (e.g. `https://xxxx.supabase.co`)
- `DATABASE_URL` (Postgres pooler — migrations only)
- `TWELVELABS_API_KEY` (screen/video extract)
- `ANTHROPIC_API_KEY` (file/screenshot extract)

You still need:
1. `SUPABASE_SERVICE_ROLE_KEY`
2. Private Storage bucket named `media-shares` (default; override with `MEDIA_STORAGE_BUCKET`)

---

## 1. Create / copy the service role key

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project (`kfauvrvigxxctrnuegoo` if that is the Nexus project).
2. Go to **Project Settings** (gear) → **API**.
3. Under **Project API keys**:
   - **anon / public** — already used as `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser-safe).
   - **service_role** — **secret**. Copy this value.
4. Put it in repo-root `.env` (backend reads this file):

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

5. Restart API + worker so settings reload (`get_settings` is cached).

**Never** put the service role key in `frontend/.env.local` or any `NEXT_PUBLIC_*` variable. It bypasses RLS and must stay server-only (Railway/backend env only in deploy).

If the key is missing, uploads fail with a clear 503:  
`Supabase Storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY`.

---

## 2. Create the private `media-shares` bucket

### Dashboard (simplest)

1. Supabase Dashboard → **Storage**.
2. **New bucket**.
3. Name: `media-shares` (must match `MEDIA_STORAGE_BUCKET` / default in `backend/app/config.py`).
4. **Public bucket: OFF** (private).
5. Optional: enable file size limits to match the API (screenshots/files ~15 MB; screen clips up to ~100 MB).
6. Create.

Nexus object path shape:

```text
{workspace_id}/{session_id}/{share_id}/{file_name}
```

Backend upserts via the Storage REST API with the service role. Respondents never receive a durable public URL (by-token list is status-only).

### CLI (optional)

With [Supabase CLI](https://supabase.com/docs/guides/cli) linked to the project:

```bash
supabase storage create media-shares --public false
```

Or SQL (Storage schema; use if your project prefers SQL ops):

```sql
insert into storage.buckets (id, name, public, file_size_limit)
values ('media-shares', 'media-shares', false, 104857600)  -- 100 MB
on conflict (id) do update set public = false;
```

You typically do **not** need open RLS policies for anonymous clients: the service role bypasses RLS. Do not add a public `select` policy on this bucket.

---

## 3. Apply the Postgres migration

Migrations are applied by hand (see `backend/README.md`). For media shares:

```bash
# From repo root, with DATABASE_URL pointing at the target DB
psql "$DATABASE_URL" -f backend/db/migrations/0033_media_shares.sql
```

Or via Supabase Dashboard → **SQL Editor** → paste / run `0033_media_shares.sql`.

That creates `media_shares` and seeds agent configs `media_extract_document` + `media_extract_screen`.

Also apply `0033` to any local pgvector DB you run (tests re-apply via `conftest.MIGRATIONS`).

---

## 4. Env checklist (backend)

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...          # from API settings — server only
MEDIA_STORAGE_BACKEND=supabase           # default; tests use memory
MEDIA_STORAGE_BUCKET=media-shares        # default
TWELVELABS_API_KEY=...
ANTHROPIC_API_KEY=...
```

Run **both** processes after config changes:

```bash
uvicorn app.main:app --reload --port 8000   # from backend/
python -m app.worker                        # drains extract_media_share + compile
```

---

## 5. Quick verify

1. Service role set → restart API.
2. Bucket `media-shares` exists and is **private**.
3. Open an interview `/i/...` → **Share** → File (small PNG) → chip moves Uploading → Extracting → Ready.
4. In Dashboard → Storage → `media-shares`, confirm an object under `{workspace}/{session}/...`.
5. Confirm worker logs show `extract_media_share` and a `compile_session` job (CLAIMED).

If Storage upload returns 404 from Supabase, the bucket name is wrong or missing. If 401/403, the service role key is wrong or truncated.