<!-- Sources: docs/MERGE_PLAN.md Phase 1 (hedge detection full-utterance judgment, EN+TR lexicons as MINIMUM trigger set, uptalk/trailing-off F20) + stage4-compiler.md Step 3 (GUESS: any hedge → GUESS; non-lexical hedges count) + A2 (hedge-lexicon audit is Emre's; we ship v1) + A13 (TR designed-in). v1 OURS — Emre's audited lexicon replaces it on arrival; diff, don't silently overwrite. -->

# {{PRODUCT_NAME}} — Hedge Lexicon (EN / TR)

Hedges are the compiler's primary signal that a statement is a **GUESS**, not a fact. Hedging is involuntary; it overrides how specific or confident the rest of the sentence sounds. This lexicon is the **minimum trigger set** — a floor, not the definition. The real test is always **full-utterance judgment**: if the whole utterance conveys uncertainty, it's a GUESS even when no listed word appears.

## How to use this
- **Any listed trigger present → GUESS** (per compiler Step 3), regardless of how crisp the rest is.
- **Absence of a listed word does NOT mean "not hedged."** Judge the whole utterance; the non-lexical cues below carry equal weight.
- **Never translate** the respondent's words when recording vocabulary — you detect the hedge, you don't rewrite the sentence.
- A GUESS is not bad data; it is an automatic verification objective.

## English — minimum trigger set
I think · I believe · I guess · I assume · I'd say · probably · maybe · perhaps · possibly · as far as I know · from what I remember · if I remember right · last time I checked · not sure but · I'm not certain · don't quote me · must be · should be · I suppose · roughly · around (with a number) · about (with a number) · or so · give or take · something like · more or less · kind of · sort of · a ballpark · off the top of my head · I could be wrong · in theory · generally (when softening a specific claim)

## Turkish — minimum trigger set
sanırım · herhalde · galiba · bence · zannedersem · tahminen · tahminimce · yaklaşık · civarında · aşağı yukarı · az çok · falan · filan · gibi bir şey · sanki · belki · olabilir · olsa gerek · hatırladığım kadarıyla · bildiğim kadarıyla · tam emin değilim ama · emin değilim · yanılmıyorsam · diye biliyorum · gibi · -dır/-dir (speculative "must be": "yapıyordur")

## Non-lexical hedges (no keyword — judgment only)
These carry the same weight as any word above. In voice especially, they are often the *strongest* uncertainty signal.

- **Uptalk** — a statement delivered as a question ("it takes two hours? every morning?"). The rising intonation is the hedge.
- **Trailing off** — the sentence dies before the claim lands ("and then it's usually about, you know…").
- **Self-interruption / restart** — the speaker abandons a frame mid-claim ("I go to Apollo, I'll search — actually it depends —").
- **Long pause before a number** — hesitation before quantifying ("it takes… [pause] …maybe forty minutes").
- **Hedged frame around a crisp fact** — "I mean, roughly, the way it usually works, more or less" wrapped around specifics still reads GUESS.
- **Epistemic distancing** — "supposedly", "apparently", "they say", "I've been told" → the speaker is reporting someone else's claim, not their own knowledge (often CLAIMED-at-most, GUESS if also hedged).

## Interaction with the tag ladder (reference — the compiler owns tagging)
- Hedge present → **GUESS**, full stop.
- No hedge, but describing someone else's work or a general/habitual pattern, or stating any number → **CLAIMED** at most.
- No hedge, firsthand, specific episode, concrete detail → **CONFIRMED**.
- When torn between two tags, take the lower-trust one.

## Notes for the audit (Emre)
- This is v1, ours. Emre's audit may add regional/register variants, weight non-lexical cues, and tune the TR set for spoken vs written registers.
- Candidate additions to review: TR softeners "ya", "işte", "yani" (often filler, not hedge — context-dependent; do NOT auto-trigger on these); EN "literally/basically" (usually intensifiers, not hedges).
- Diff against Emre's version on arrival; surface conflicts, never silently overwrite either direction.
