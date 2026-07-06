<!-- Kaan eval-integrity directive (task #12), point 1. BLIND labeling sheet for the Auria Jewellery
     golden transcript. Label each utterance WITHOUT looking at the compiler's output. The model's
     answers live separately in evals/compiler/golden-jewelry-expected-records.yaml (the "answer key")
     — open it ONLY after you've filled this sheet, then compare. A record freezes (loses PROVISIONAL)
     only where your independent label agrees with the model's; disagreements are the interesting data. -->

# Golden adjudication — Auria Jewellery (fictional), founder interview

**Blind-labeling protocol.** Two labelers (Kaan, Emre) fill this sheet independently, without reading the
compiler's output. Then open the answer key (`evals/compiler/golden-jewelry-expected-records.yaml`) and mark,
per row: **agree / disagree / unsure**. We freeze only the records where both humans agree with each other and
with the model. Everything else gets discussed — those disagreements are exactly what "realism over green
checkmarks" is protecting. Transcript: `evals/compiler/golden-jewelry-transcript.md`.

## Labeling legend (from stage4-compiler.md)

- **kind**: statement · directive · admission · correction · **FILLER→discard (no record)**
- **topic** (statements only): pain · process_step · person · tool · vocabulary · time_or_cost · company_fact · success_criteria
- **tag** (statements/corrections only; directive & admission = no tag): guess < claimed < confirmed
  - guess = any hedge (incl. uptalk / trailing off) · claimed = sure-but-distant / habitual / any number · confirmed = firsthand specific episode, unhedged
- **flags**: sentiment_quarantine (opinion about a named person's competence/character) · approach_note (temperament for interview conduct)
- Also note: **# of records** this utterance should yield · any **supersedes** · any **triggers** (NEW-PERSON / INTERVIEW-OBJECTIVE / SEQUENCING / CONFLICT)

---

## Utterances to label

For each, decide how many records (0 for filler), and label each record. Blank cells = your call.

### U1 — 00:20
> "Can you hear me alright? Okay. I'm ready to begin."

| # records? | kind | topic | tag | flags | notes |
|---|---|---|---|---|---|
|   |   |   |   |   |   |

### U2 — 00:35
> "We're a fine jewellery brand, handmade pieces, mostly gold with coloured stones. We've got nine boutiques now — actually let me correct that, the website still says twelve. We closed the two in Izmir and one in Bursa last year. So nine."
> *(Stage-1 SCRAPED context on file: "operates 12 boutiques.")*

| # records? | kind | topic | tag | flags | supersedes? | notes |
|---|---|---|---|---|---|---|
|   |   |   |   |   |   |   |

### U3 — 01:08
> "Our atelier in Istanbul. Twelve craftspeople, I'd say — roughly twelve, I'd have to check the exact number. Led by Selin, she's been our master jeweller since the beginning."

| # records? | kind | topic | tag | flags | triggers? | notes |
|---|---|---|---|---|---|---|
|   |   |   |   |   |   |   |

### U4 — 01:36
> "So a customer orders online or in a boutique. If it's a standard piece we usually have stock. If it's custom, it goes to the atelier queue. And we have what we call 'yıldırım sipariş' — the rush orders, when someone needs a piece for a wedding in a few days. Those jump the queue."

| # records? | kind | topic | tag | flags | notes |
|---|---|---|---|---|---|
|   |   |   |   |   |   |

### U5 — 02:12
> "Kerem handles that. Every morning he goes through the overnight orders and reprices anything where the gold price moved, then flags the rush ones. It takes him, I don't know, maybe two hours? Every morning I think. He's got his own spreadsheet for it, had it for years."
> *(Follow-up at 02:52: "Oh, that's a guess honestly. I've never timed it. You'd have to ask Kerem.")*

| # records? | kind | topic | tag | flags | triggers? | notes |
|---|---|---|---|---|---|---|
|   |   |   |   |   |   |   |

### U6 — 03:12
> "Returns take about forty minutes each, start to finish. Someone checks the piece, logs it, refunds. Actually — no. Since we moved to the new label printer it's more like ten minutes now. Ten. Pınar set that up."

| # records? | kind | topic | tag | flags | supersedes? | notes |
|---|---|---|---|---|---|---|
|   |   |   |   |   |   |   |

### U7 — 03:44
> "She runs the returns desk. Newer, joined maybe eight months ago. Between us — and this stays with you — Metin, who used to own returns, he's a good man but he was pretty disorganized about it, honestly. That's why we moved it to Pınar. Metin's on the packing side now."

| # records? | kind | topic | tag | flags (watch for quarantine!) | triggers? | notes |
|---|---|---|---|---|---|---|
|   |   |   |   |   |   |   |

### U8 — 04:30
> "Honestly? If I could see, on one screen, exactly where every custom order is and who's holding it up. Right now I'm chasing people on WhatsApp. We even have a group we call 'Müşteri Takip' for it. That's the dream — no more chasing."

| # records? | kind | topic | tag | flags | notes |
|---|---|---|---|---|---|
|   |   |   |   |   |   |

### U9 — 05:08
> "Yes — don't bring up the acquisition talks with anyone on the floor. We haven't announced it, and I don't want it leaking. Please keep that off the table entirely."

| # records? | kind | topic | tag | flags | triggers? | notes |
|---|---|---|---|---|---|---|
|   |   |   |   |   |   |   |

### U10 — 05:40
> "Last week. A bridal set, the customer called three times, and it turned out the piece had been sitting finished in the atelier for two days because nobody told Kerem it was done. I only found out when the customer emailed me directly. That one stung."

| # records? | kind | topic | tag | flags | notes |
|---|---|---|---|---|---|
|   |   |   |   |   |   |

---

## After labeling — reconcile

1. Open `evals/compiler/golden-jewelry-expected-records.yaml` (the model's answers).
2. For each record, mark **agree / disagree / unsure** vs your label.
3. Where Kaan and Emre both agree with the model → that record freezes (remove PROVISIONAL for it).
4. Where you disagree (with the model or each other) → note it; these drive persona/compiler fixes, not the other way around.

### The rows most worth scrutinizing (known judgment-calls, not hints at the "right" answer)
- U2 & U6 both contain a self-**correction** mid-utterance — does it supersede, and does the superseded record survive?
- U3, U5, U7 all contain hedges (*"I'd say," "roughly," "maybe," "I don't know," "I think"*) — do those force **guess** even over specific numbers?
- U5 mixes someone-else's-work + a hedged number — one record or several, and what tag ceiling?
- U7 carries both a fact and a competence judgment about **Metin** — should it split, and is the judgment **quarantined**?
- U9 is a **directive** — does it carry a trust tag at all, and what feeds the NEVER list?
- U10 is the one likely **confirmed** (episodic) statement in a founder call — do you agree it's episodic enough?
- U1 — is any of it a record, or all filler?
