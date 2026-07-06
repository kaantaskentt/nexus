"""Parse a pasted CEO-call transcript into verbatim utterances.

Voice/transcript rule (non-negotiable): the text is the product. We NEVER clean up
what was pasted — fillers, hedges, false starts, and non-English tokens are data the
compiler needs. The only thing we lift out is a leading "Speaker:" label, and only into
the speaker field; the spoken text after it is kept byte-for-byte.
"""

import re

# Conversation-side labels that mean the interviewer/consultant, not the founder.
_AGENT_LABELS = {
    "agent", "interviewer", "consultant", "q", "question", "host", "moderator",
    "nexus", "facilitator", "me",
}

# "Name:" or "Name -" at the very start of a line. The label must be a SINGLE token (no
# internal spaces) so a normal sentence with a colon — "One thing: don't mention Harrods"
# — is never misread as a speaker label and silently truncated. Losing a label to verbatim
# text is safe (the compiler attributes turns to the session's interviewee anyway); losing
# spoken words is not.
_LABEL_RE = re.compile(r"^\s*([A-Za-z][\w.'&/-]{0,23})\s*[:\-–—]\s+(.*\S.*)$")


def parse_transcript(text: str) -> list[dict]:
    """Return [{turn_index, speaker, text}] with speaker in {'agent','respondent'}.

    Each non-empty line becomes one turn. Lines with a recognized "Speaker:" prefix are
    attributed by the label; everything else is the respondent (the founder on the call).
    If nothing at all is parseable, the whole blob is a single respondent turn so no
    content is ever dropped.
    """
    turns: list[dict] = []
    for raw in text.splitlines():
        if not raw.strip():
            continue
        m = _LABEL_RE.match(raw)
        if m:
            label = m.group(1).strip().lower()
            speaker = "agent" if label in _AGENT_LABELS else "respondent"
            spoken = m.group(2)  # verbatim — never trimmed of hedges/fillers
        else:
            speaker = "respondent"
            spoken = raw.strip()
        turns.append({"turn_index": len(turns), "speaker": speaker, "text": spoken})

    if not turns and text.strip():
        turns.append({"turn_index": 0, "speaker": "respondent", "text": text.strip()})
    return turns
