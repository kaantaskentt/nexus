# Simulations surface: global vs workspace (design proposal for Kaan)

**The problem (your queue item, July 8):** the cast and proving rounds are the PRODUCT's
testing record, but they render inside every workspace's nav, so a brand-new tenant sees
"someone else's" content and reads it as stuck. And the raw scores (14/16, 0/16) ask the
reader to do the interpreting.

**Options considered:**
- (a) Move it out of workspace nav entirely to a product-level "How Nexus is tested"
  page (picker level or marketing surface). Cleanest conceptually; costs the in-context
  trust moment (an admin deciding whether to send a real invite is INSIDE a workspace).
- (b) Keep it in nav, framed explicitly as the product-wide proving record, with
  plain-language headlines. Cheapest, keeps the trust content where the decision happens.
- (c) Per-workspace simulations (pressure-test THIS company's plan against personas
  built from THIS company's records). The real destination: it makes the page genuinely
  workspace-scoped and is the natural home for the (still PROPOSED) Run button.

**Shipped tonight (the modest version = option b):**
- A framing block under the explainer: this is the product's own testing record, the
  same interviewer serves every company, it is not this company's data.
- Headline-sentence-first scores ("The interviewer surfaced 14 of 16 hidden facts and
  took zero bait."), raw counts demoted to small secondary chips.

**Recommendation:** hold (b) for the MVP; build (c) when the Run button gets approved —
they are the same feature (a run against your plan produces YOUR rounds, and the global
record moves to a "How we test" footer link). Option (a) only if you want Simulations
out of the client nav entirely. Your call; one line back and I execute.
