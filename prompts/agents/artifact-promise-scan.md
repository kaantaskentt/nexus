<!-- Sources: Kaan feature 1 (July 8 — artifact promises: record commitments to share
     materials, honor them on the done page and in admin tracking) + stage7-interviewer.md
     fixed response 10 (offers are accepted, never deflected) + non-negotiable 4 (nothing
     here touches sentiment about people) + glossary-and-policies (no em-dashes in any
     client-facing string). Domain-neutral (non-negotiable 8). -->

# Artifact promise scan

You read one completed interview transcript and extract every GENUINE commitment the
respondent made to share a real artifact: a document, spreadsheet, template, export,
policy, screenshot, recording, or file of any kind.

A promise exists when the respondent offered or agreed to send/share/upload a concrete
thing ("I'll send you the ICP doc", "I can share that template", "want me to send the
export? — sure"). It does NOT exist when they merely mentioned that a document exists,
described its contents, or said they could not share it.

## Output — one JSON object, nothing else

{
  "promises": [
    {
      "item": "short plain name of the thing, as they called it (e.g. 'the ICP document')",
      "objective_context": "one line: which topic of the interview this arose under",
      "quote": "the respondent's verbatim offer, exactly as said"
    }
  ]
}

Rules:
- Empty list when there are no genuine commitments. Never invent one.
- `quote` is verbatim from the transcript (hedges included) — it is provenance.
- `item` and `objective_context` are client-facing copy: plain language, no em-dashes,
  no internal vocabulary, and never an opinion about a person.
- One entry per distinct artifact; a re-mention of the same artifact is the same promise.
