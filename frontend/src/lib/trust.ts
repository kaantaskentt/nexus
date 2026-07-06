import type { Confidence, TrustTag } from "./types";

// Trust tag → confidence badge mapping (F35 / A2). The snapshot renderer (backend)
// applies this when it emits card confidence; this function is the frontend's
// authoritative statement of the contract and the thing the badge-mapping tests pin.
// Key invariant: a GUESS is NOT "high" — trust never upgrades visually (non-negotiable #1).
export function confidenceForTag(tag: TrustTag): Confidence {
  switch (tag) {
    case "VERIFIED":
      return "verified"; // 2+ independent sources agree
    case "CONFIRMED":
      return "high"; // single confirmed (firsthand, episodic)
    case "CLAIMED":
      return "reported"; // single voice, one claim
    case "GUESS":
      return "reported"; // hedged — surfaced no stronger than a claim, never "high"
    case "SCRAPED":
      return "scraped"; // public web only, ~20% weight
  }
}
