<!-- Sources: reference/nexus_question_bank.pdf (Tunç/Kaan — the full elicitation catalog) + reference/nexus_spine.pdf
     (the 9-slot universal spine + action boundary + type-specific 3-bucket layer) + prompts/glossary-and-policies.md
     (terms + policies) + docs/MERGE_PLAN.md A6 (custom path) / A10 (no executable skills v1) / A12 (fictional data) +
     Kaan side-order (no em-dashes in client-facing copy). Vendored for #24 re-mine (adopt-now): the plan-generator
     and Stage 3 PRUNE + PERSONALIZE from this catalog; they never invent standing questions or free-style the survey.
     Copy here is rendered client-ready (no em-dashes) because these questions are asked to real respondents. -->

# Question Bank — the elicitation catalog (source of truth)

The full catalog of questions the system can ask, shown as the respondent would answer them. Every question the
plan-generator or the Stage 3 CEO call surfaces is **pruned and personalized from this file** — never invented. The
per-client generator drops what does not apply and rewrites wording to the client's vocabulary; it must not add a new
standing question or drop a "never dropped" one. Tags mark **who** answers: `everyone` · `leadership·call` (asked of
leadership, usually on the CEO call) · `does the work` (asked of the operator) · `manager`.

**Scale rule (psychometric, from the spine):** rating scales are **even-numbered (1 to 6), no neutral middle** — a
respondent must lean. Never a decimal, never a 0 to 100 score.

**Sensitive-data screen rule:** the leadership screening block is **closed and forced** — every item must be answered;
`Not sure` triggers a follow-up, never a pass. It composes with (does not replace) the credentials-exclusion guard in
`nexus-check-reviewer.md`: the screen establishes what sensitive categories exist so the plan can EXCLUDE probing them
from employee interviews, not invite it.

---

## 1. Standing questions (always included, never dropped)

### How change lands
- **If a helper took the boring, repetitive parts of your day off your hands, how would that feel?**
  `[1 to 6: I'd hate it ... I'd love it]` · everyone
- **Would you trust it to do your work the way you'd want?** `[1 to 6: Not at all ... Completely]` · everyone
- **What's the biggest time-waster in your day?** `[open]` · everyone

### Where people see it differently (perception-gap seeds)
- **Where does work most often get stuck or held up?** `[open]` · everyone
- **What's the one thing your team gets right that must never break?** `[open]` · everyone

## 2. Leadership screening (data and rules) — closed, forced, Yes / No / Not sure

- **Does this work involve personal info about customers or staff (names, contact details)?** · leadership·call
- **Does it involve payment or financial information?** · leadership·call
- **Does it involve health or medical information?** · leadership·call
- **Are you in a regulated industry (healthcare, finance, legal, insurance)?** · leadership·call
- **Are there rules about keeping records, or who can access information?** · leadership·call

## 3. Universal questions — the 9-slot spine

Every workflow needs these. Slots 3 and 4 are often inferable from a strong Slot 9 example (keeps the survey lean).

- **Slot 1 · Task**
  - Which jobs eat the most time or cause the most headaches? · leadership·call
  - What's one job you do over and over that you'd love a hand with? · does the work
  - If a helper could take part of it off your plate, what would you hand them first? `NEW` · does the work
- **Slot 2 · Trigger** — What makes this job start? `[schedule / someone asks me to / something comes in (an email, order, or message) / something else]` · does the work
- **Slot 3 · Steps** — Walk us through how you do it, start to finish, the little steps too: what you click, check, or send. · does the work
- **Slot 4 · Decision rules**
  - Is there a point where you pick between two ways to do it? What helps you choose? · does the work
  - If you were training your replacement for a day, what's the one tip you'd pass on? · does the work
- **Slot 5 · Exceptions** — What usually goes wrong with it, and what do you do when it does? · does the work
  <!-- The under-probed slot: a terse respondent will not volunteer this; the interviewer must drive it (EVALS §7 mined cases). -->
- **Slot 6 · Tools**
  - Which tools does the team use for this, and who looks after them? · leadership·call
  - Which apps or tools do you use for it? `[Email / Google Sheets or Excel / Canva / a booking site / CRM / something else]` · does the work
- **Slot 7 · Output**
  - When it's done, what have you made? `[document / spreadsheet / email or message / social post / something else]` `NEW` · does the work
  - Where does it go when it's finished? · does the work
- **Slot 8 · Success**
  - How do you know you did a good job on it? `NEW` · does the work
  - Is there a clear right answer, or is it more of a feel? `[clear right answer / more of a feel]` · does the work
  - How do you judge whether this was done well for the client? · leadership·call
- **Slot 9 · Examples (highest value)** — the single most important input.
  - Could you show us one example of this done really well? Paste it, or upload the file. `NEW` · does the work
  - Is there a template, checklist, or guide you work from? Can you share it? · does the work

## 4. Action boundary (what a person signs off) — `NEW`

Not for building executable skills in v1 (A10). Captured so the workflow map records where human sign-off belongs.

- What should the assistant be allowed to do on its own, and what should a person okay first? · leadership·call
- Is there a point where money's spent, something goes to a customer, or a promise is made? Who signs off? · leadership·call

## 5. Voice / tone

- Is there a tone or style the output has to match? Anything it should always or never do? · leadership·call
- How would you describe the right tone for this? · does the work

## 6. Type-specific blocks (only the matching one is added)

Reweighted by workflow family. The generator adds exactly the block(s) that match the client's work.

### Content / social media
- Which platforms, and does each have its own rules? · leadership·call
- What makes a post feel on-brand vs off (tone, words, emoji)? · leadership·call
- Is there a brand kit (logo, fonts, colours, hashtags)? Can you share it? · does the work
- Which kinds of posts do you make? `[caption / carousel / thread / reel / story / other]` · does the work
- How often do you post, and how much is planned vs last-minute? · manager
- Who checks a post before it goes out? Anything that must be on it (like #ad)? · leadership·call

### Booking / scheduling
- Which booking sites or systems do you use? · leadership·call
- What does every booking need (traveller, dates, preferences, payment)? · does the work
- Any budget limits, preferred suppliers, or amounts that need approval? · leadership·call
- Any repeat-customer preferences worth remembering? · does the work
- Should it actually book (spend money, commit) or get it ready for someone to confirm? · leadership·call

### Admin / invoicing
- Which accounting tool or spreadsheet do you use? Can you share a real, anonymised one? · leadership·call
- What's the invoice template? Can you share it? · does the work
- Any tax, payment-term, or record-keeping rules? · leadership·call
- When you check payments off, what counts as a match? · does the work
- Should it send invoices and record entries, or just get them ready? · leadership·call

### Customer support / communication
- Which channels (email, chat, DM, reviews) and which help-desk tool? · leadership·call
- Is there a help centre or policy doc to answer from? Can you share it? · does the work
- When should it pass something to a person instead of handling it? · leadership·call
- What's the right tone, especially with an upset customer? · leadership·call
- What can it offer (refund, discount) without asking first? · leadership·call
- Could you share a few real messages and the replies that worked? · does the work

---

## How the generator uses this (contract)

1. **Prune** the standing + spine + one matching type-specific block to the client. Never drop a "never dropped" item.
2. **Personalize** wording to the client's vocabulary (from the CEO call), keeping the question's intent + tag.
3. **Never invent** a standing question. A genuinely new need is a gap to flag, not a free-styled question.
4. **Cite this file** as the source in any generated plan's provenance.
5. **Definition of done (the eval):** a plan is complete when every must-hit objective maps to at least one sourced
   question here; a follow-up the plan still needs is a missing slot, not a reason to free-style.
