# UI inspiration — sprint-2 (Voice Settings + Live interview room)

Drop the taste-approved GPT reference PNGs here for pixel reference (Kaan holds them).

**Read the verdict before building against these images:** `docs/MERGE_PLAN.md` **A19**.
The references are taste-approved EXCEPT four mandatory corrections that override the mock:

1. Live-insight trust badges come from the real trust ladder — a single-source live claim
   is "Reported/stated" at most, never "Verified" (the mock's all-Verified is the lie we
   don't tell). Reuse `frontend/src/lib/trust.ts` / `ConfidenceBadge`.
2. Observer view = orb+transcript inside the admin shell; the respondent room is the same
   elements chrome-free (no nav/breadcrumbs/trail). See also A18 (neutral live progress).
3. No employee face photos anywhere — initials chips only.
4. Voice picker uses abstract waveform tiles, not face photos (name, gender, language, preview).

Binds Lane B (#39 Voice Settings) and Lane C (#40 live room + observer).
