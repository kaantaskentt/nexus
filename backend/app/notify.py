"""Reviewer notification for Section-7 harm incidents (KAAN-RULINGS-jul10 R2).

An email to the Nexus reviewers (Kaan + Emre) that a disclosure was flagged and
quarantined, carrying ONLY {category, coarse bucket, timestamp, session_ref} — NO verbatim
disclosure content (§7.6 minimization). The reviewer acts from the sealed-flag / incident
ops layer; the email is a signal, not the record.

Hard invariant: notification NEVER blocks or fails a session/job. If the SendGrid key or
the reviewer recipients are absent from the env, we log + return 'skipped' and the incident
row still persists for manual review. A send error returns 'failed', logged, never raised.
The `sendgrid_api_key` (config.py) is used directly via the SendGrid v3 REST API over the
httpx that ships with the Anthropic SDK — no new dependency."""

import logging

import httpx

from .config import get_settings

log = logging.getLogger("nexus.notify")

_SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send"


def build_incident_email(*, incident_id, category, bucket, session_ref, created_at) -> dict:
    """The SendGrid payload for one incident. Built from the MINIMIZED fields only — there
    is deliberately no place here for verbatim disclosure content (§7.6). Kept pure so a
    test can prove the no-verbatim guarantee without touching the network."""
    settings = get_settings()
    recipients = [e.strip() for e in settings.incident_notify_emails.split(",") if e.strip()]
    subject = f"[Nexus] Disclosure flagged for review — {bucket} / {category}"
    body = (
        "A disclosure was flagged during a Nexus interview and quarantined at the data "
        "layer. This notification carries no verbatim content by design (Section 7.6); "
        "review it in the sealed-flag / incident ops layer.\n\n"
        f"Category: {category}\n"
        f"Bucket (agent coarse recognition; the reviewer assigns the final tier): {bucket}\n"
        f"When: {created_at}\n"
        f"Session reference: {session_ref}\n"
        f"Incident reference: {incident_id}\n"
    )
    return {
        "personalizations": [{"to": [{"email": e} for e in recipients]}],
        "from": {"email": settings.email_from},
        "subject": subject,
        "content": [{"type": "text/plain", "value": body}],
    }


async def send_incident_notification(*, incident_id, category, bucket, session_ref, created_at) -> str:
    """Best-effort reviewer email. Returns 'sent' | 'skipped' | 'failed'. Never raises."""
    settings = get_settings()
    recipients = [e.strip() for e in settings.incident_notify_emails.split(",") if e.strip()]
    if not (settings.sendgrid_api_key and settings.email_from and recipients):
        log.warning(
            "harm-incident %s: reviewer email SKIPPED (sendgrid/email config absent) — "
            "incident persisted, needs manual review",
            incident_id,
        )
        return "skipped"
    payload = build_incident_email(
        incident_id=incident_id, category=category, bucket=bucket,
        session_ref=session_ref, created_at=created_at,
    )
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            resp = await c.post(
                _SENDGRID_URL, json=payload,
                headers={"Authorization": f"Bearer {settings.sendgrid_api_key}"},
            )
            resp.raise_for_status()
        log.info("harm-incident %s: reviewer email sent (%s / %s)", incident_id, bucket, category)
        return "sent"
    except Exception as e:
        log.error(
            "harm-incident %s: reviewer email FAILED (incident persisted, needs manual "
            "review): %s",
            incident_id, e,
        )
        return "failed"
