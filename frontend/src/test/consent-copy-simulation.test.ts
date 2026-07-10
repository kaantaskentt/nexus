import { describe, it, expect } from "vitest";
import { consentCopy, type RespondentSession } from "@/lib/respondent";

// SIMPLIFY I: consentCopy() gains a SIMULATION branch. A simulation is a practice run —
// there is no real person, so NONE of the respondent promises (attribution, anonymity /
// role-only sharing, recording into a snapshot) may appear. This pins that, and pins the
// employee + context branches unchanged (the sim branch is added ABOVE them, not into them).

function base(over: Partial<RespondentSession> = {}): RespondentSession {
  return {
    id: "s",
    status: "active",
    modality: "text",
    language: "en",
    transcript: [],
    context: { respondent_name: "Kaan", company_name: "Bee Goddess" },
    ...over,
  };
}

// Promise phrasing that belongs ONLY to a real respondent — must never appear in a sim.
const REAL_PERSON_PROMISES = [
  /attributed to you as its source/i,
  /shared by role/i,
  /with your name on it/i,
  /rate anyone/i,
  /your company snapshot/i,
];

function blob(c: ReturnType<typeof consentCopy>): string {
  return JSON.stringify([c.heading, c.intro, c.whatItIs, c.handling, c.consentFinePrint]);
}

describe("consentCopy — simulation branch (SIMPLIFY I)", () => {
  it("a simulation states it's a practice run and makes NO real-person promises", () => {
    const c = consentCopy(base({ simulation: { label: "Daily Gold Repricing" } }));
    expect(c.heading).toBe("Practice run · Daily Gold Repricing");
    expect(c.startAction).toBe("Start the simulation");
    const text = blob(c);
    for (const promise of REAL_PERSON_PROMISES) {
      expect(text).not.toMatch(promise);
    }
    // It IS explicit that nothing reaches records.
    expect(text).toMatch(/nothing.*(reaches|recorded into).*company records/i);
    expect(text).toMatch(/stored as company knowledge/i); // "Nothing said here is stored as…"
  });

  it("the employee interview consent is unchanged (still carries the role-only promises)", () => {
    const c = consentCopy(base());
    const text = blob(c);
    expect(text).toMatch(/shared by role/i);
    expect(text).toMatch(/quoted with your name/i);
    // And it must NOT have leaked simulation wording.
    expect(text).not.toMatch(/practice run/i);
    expect(c.startAction).toMatch(/start the conversation/i);
  });

  it("the context-call consent is unchanged (still carries the attribution promise)", () => {
    const c = consentCopy(base({ context_call: true }));
    const text = blob(c);
    expect(text).toMatch(/attributed to you as its source/i);
    expect(text).not.toMatch(/practice run/i);
  });
});
