"""Tea-break v1 — fade-triggered pause offer (Emre stage-7 §4 time-and-burden, APPROVED
by Kaan July 7 with his framing: natural-language progress context, offered ONCE max,
never mid-story; A26).

Deterministic v1 signal set over the transcript so far (no model seat, testable):
  - shrinking answers: respondent turns steadily contracting vs their earlier baseline
  - monosyllabic streak: the last few respondent turns all near-monosyllabic
  - time mentions: personal time-pressure phrases (about THEIR clock, not workflow
    durations — "takes two minutes" is content, "I have a meeting" is a signal)
  - flat checkpoint: a bare two-word confirmation after a long agent playback turn

Two independent signals must fire (one alone is personality, two is fade). The engine
injects ONE nudge; the persona picks the seam. Phase-two live burden detection replaces
this set later (OPEN, as drafted)."""

import re

MIN_RESPONDENT_TURNS = 5

_TIME_PRESSURE = re.compile(
    r"\b(how (much )?longer|how long (is|will) this|i have (a|another) (meeting|call)|"
    r"need to (go|run|leave)|have to (go|run|leave)|gotta (go|run)|running late|"
    r"can we (hurry|speed|wrap)|short on time|out of time|vaktim (yok|dar)|"
    r"acelem var|toplantım var|çıkmam lazım)\b",
    re.IGNORECASE,
)
_FLAT_OK = re.compile(r"^(yeah|yep|yes|sure|right|ok|okay|uh huh|mhm|doğru|evet|aynen)[.!]?$",
                      re.IGNORECASE)


def _words(text: str) -> int:
    return len((text or "").split())


def detect_fade(utterances: list[dict]) -> dict | None:
    """Returns {"signals": [...]} when >=2 fade signals fire, else None."""
    resp = [u for u in utterances if u["speaker"] == "respondent"]
    if len(resp) < MIN_RESPONDENT_TURNS:
        return None

    signals: list[str] = []
    lens = [_words(u["text"]) for u in resp]

    # Shrinking answers: last three each no longer than the one before, and the last one
    # under 40% of the earlier-turns average (so a naturally terse respondent, flat from
    # the start, does not read as fading).
    baseline = sum(lens[:-3]) / max(1, len(lens[:-3]))
    if lens[-1] <= lens[-2] <= lens[-3] and baseline > 0 and lens[-1] < 0.4 * baseline:
        signals.append("shrinking answers")

    # Monosyllabic streak: three near-monosyllabic turns in a row, against a baseline
    # that was not like that (same personality guard).
    if all(n <= 4 for n in lens[-3:]) and baseline > 8:
        signals.append("monosyllabic streak")

    # Personal time pressure in the recent turns.
    if any(_TIME_PRESSURE.search(u["text"] or "") for u in resp[-3:]):
        signals.append("time mentions")

    # Flat checkpoint: a long agent turn (a playback) answered with a bare confirmation,
    # within the last two respondent turns.
    recent = resp[-2:]
    for i in range(1, len(utterances)):
        u, prev = utterances[i], utterances[i - 1]
        if (u["speaker"] == "respondent" and prev["speaker"] == "agent"
                and _words(prev["text"]) >= 40
                and _FLAT_OK.match((u["text"] or "").strip())
                and any(u is r for r in recent)):
            signals.append("flat checkpoint confirmation")
            break

    if len(signals) >= 2:
        return {"signals": signals}
    return None


def progress_phrase(elapsed_min: float, budget_min: float) -> str:
    """Honest progress in natural language for the offer — never a percentage readout."""
    remaining = max(0, round(budget_min - elapsed_min))
    frac = elapsed_min / budget_min if budget_min else 1.0
    if frac < 0.4:
        stage = "still fairly early"
    elif frac < 0.6:
        stage = "about halfway"
    elif frac < 0.85:
        stage = "about two-thirds of the way through"
    else:
        stage = "nearly done"
    if remaining > 0:
        return f"{stage}, maybe {remaining} minutes left"
    return f"{stage}, just about wrapping up"


def build_fade_nudge(signals: list[str], elapsed_min: float, budget_min: float) -> str:
    progress = progress_phrase(elapsed_min, budget_min)
    return (
        "## Attention check (engine-side)\n"
        f"The respondent may be fading (signals: {', '.join(signals)}). At the NEXT "
        "natural seam — after a checkpoint playback or the end of an episode, never "
        "mid-story — offer a break once, warmly and with honest progress in natural "
        f"language, e.g.: \"We're {progress}. Want to keep going, or take a break here? "
        "The same link picks up exactly where we left off.\" Offer it ONCE: if they "
        "continue, do not offer again this session, and respect their answer either way."
    )
