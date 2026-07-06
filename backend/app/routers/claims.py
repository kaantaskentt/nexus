"""Claim record queries. Client-facing reads use client_visible_claims ONLY —
the quarantine lives in the view, not in per-endpoint filters (non-negotiable #4)."""

import json

from fastapi import APIRouter

from ..db import get_pool

router = APIRouter()


@router.get("/{workspace_id}")
async def list_claims(workspace_id: str, topic: str | None = None):
    """Client-visible claims with two UI aids: the speaker's role, and is_paraphrased
    (F33) — evidence from an EMPLOYEE interview is paraphrased in client views, while
    CEO-call and scraped records keep their verbatim quote. The rule lives here so the
    evidence rail can render the paraphrase affordance honestly, not guess."""
    pool = await get_pool()
    q = """select c.*, sp.role as speaker_role,
             (c.session_id is not null
              and coalesce(iv.role, '') !~* '(founder|ceo|owner|chief|executive)') as is_paraphrased
           from client_visible_claims c
           left join entities sp on sp.id = c.speaker_id
           left join interview_sessions s on s.id = c.session_id
           left join entities iv on iv.id = s.interviewee_id
           where c.workspace_id = $1"""
    args: list = [workspace_id]
    if topic:
        q += " and c.topic = $2"
        args.append(topic)
    rows = await pool.fetch(q + " order by c.created_at desc limit 200", *args)
    return [dict(r) for r in rows]


@router.get("/{workspace_id}/records")
async def list_records(workspace_id: str):
    """The Knowledge Base browser (record store). Same deny-by-default source as every
    client read (client_visible_claims), but shaped for browsing rather than the snapshot
    rail: it joins the speaker/subject/session names the topic/person/source filters key
    on, and drops the embedding vector (dead weight for a list of every record). F33
    paraphrase flag travels so evidence renders honestly; directives/admissions keep a
    null tag (they carry no trust tag) and the UI shows their kind instead of a badge."""
    pool = await get_pool()
    rows = await pool.fetch(
        """select c.id, c.kind, c.topic, c.tag, c.claim_text, c.evidence_quote,
                  c.evidence_ts, c.mention_count, c.created_at,
                  c.session_id, c.scrape_source_id,
                  sp.canonical_name as speaker_name, sp.role as speaker_role,
                  su.canonical_name as subject_name, su.entity_type as subject_type,
                  iv.canonical_name as session_person,
                  ss.kind as scrape_kind,
                  (c.session_id is not null
                   and coalesce(iv.role, '') !~* '(founder|ceo|owner|chief|executive)')
                    as is_paraphrased
           from client_visible_claims c
           left join entities sp on sp.id = c.speaker_id
           left join entities su on su.id = c.subject_id
           left join interview_sessions s on s.id = c.session_id
           left join entities iv on iv.id = s.interviewee_id
           left join scrape_sources ss on ss.id = c.scrape_source_id
           where c.workspace_id = $1
           order by c.created_at desc
           limit 500""",
        workspace_id,
    )
    out = []
    for r in rows:
        if r["session_id"] is not None:
            source_kind = "interview"
            source_id = str(r["session_id"])
            source_label = r["session_person"] or "Interview"
        elif r["scrape_source_id"] is not None:
            source_kind = "scrape"
            source_id = str(r["scrape_source_id"])
            source_label = "Website scan" if r["scrape_kind"] == "website" else "Public data"
        else:
            source_kind = "unknown"
            source_id = "unknown"
            source_label = "Unknown source"
        out.append({
            "id": str(r["id"]),
            "kind": r["kind"],
            "topic": r["topic"],
            "tag": r["tag"],
            "claim_text": r["claim_text"],
            "evidence_quote": r["evidence_quote"],
            "evidence_ts": r["evidence_ts"],
            "mention_count": r["mention_count"],
            "is_paraphrased": r["is_paraphrased"],
            "speaker_name": r["speaker_name"],
            "speaker_role": r["speaker_role"],
            "subject_name": r["subject_name"],
            "subject_is_person": r["subject_type"] == "person",
            "source_kind": source_kind,
            "source_id": source_id,
            "source_label": source_label,
            "created_at": r["created_at"].isoformat(),
        })
    return out


@router.get("/{workspace_id}/never-list-candidates")
async def never_list_candidates(workspace_id: str):
    """DIRECTIVE records + their SEQUENCING/NEVER triggers — the plan-generator
    consumes these as NEVER-list candidates so handling instructions ("don't mention
    Harrods") shape the handoff package, not just sit in the store. Directives carry
    no trust tag and are never respondent-facing; the handoff builder enforces that."""
    pool = await get_pool()
    rows = await pool.fetch(
        """select id, claim_text, evidence_quote, provenance
           from claim_records
           where workspace_id = $1 and kind = 'directive'
           order by created_at""",
        workspace_id,
    )
    return [
        {
            "id": str(r["id"]),
            "instruction": r["claim_text"],
            "evidence_quote": r["evidence_quote"],
            "triggers": (json.loads(r["provenance"]) if isinstance(r["provenance"], str)
                         else r["provenance"]).get("triggers", []),
        }
        for r in rows
    ]
