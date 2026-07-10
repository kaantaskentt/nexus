import { describe, it, expect } from "vitest";
import { consentCopy, type RespondentSession } from "@/lib/respondent";

// SIMPLIFY D (task #6): consentCopy() branches by session kind. Two promises, two audiences.
// - The employee `interview` copy is a locked trust surface and must NOT change when the
//   context branch is added (Non-negotiable: tags/promises never drift). This suite pins it
//   byte-identical.
// - The `context` call is the founder's OWN conversation: the role-only respondent promise
//   is WRONG for them and must never appear; what they are owed is honest attribution
//   ("attributed to you as its source") + the pre-interview promise (Non-negotiable 2).

function session(over: Partial<RespondentSession> = {}): RespondentSession {
  return {
    id: "s-1",
    status: "pending",
    modality: "text",
    language: "en",
    transcript: [],
    context: {
      respondent_name: "Baris",
      company_name: "Marmara Hotel",
      admin_name: "Deniz",
      interview_topic: "how orders move",
      est_minutes: 30,
      modality: "voice",
    },
    ...over,
  };
}

describe("consentCopy — employee interview branch (locked, byte-identical)", () => {
  const c = consentCopy(session());

  it("keeps the interview headline and section titles", () => {
    expect(c.heading).toBe("A quick, honest conversation about how orders move");
    expect(c.whatItIsTitle).toBe("What this is (and isn't)");
    expect(c.handlingTitle).toBe("How your words are handled");
    expect(c.startAction).toBe("I'm ready, start the conversation");
  });

  it("keeps the role-only sharing promise verbatim", () => {
    expect(c.handling).toContain(
      'A short summary of how the work flows goes to the Marmara Hotel team who asked for it. Pain points are shared by role, like "someone in operations," not by your name.',
    );
    expect(c.whatItIs).toContain(
      "It is not a performance review. It is not scored. It's about the work, not a judgment of you.",
    );
    expect(c.consentFinePrint).toBe(
      "By starting, you consent to the recording and summary described above. You can stop at any time.",
    );
  });
});

describe("consentCopy — context call branch (leadership copy)", () => {
  const c = consentCopy(session({ context_call: true }));

  it("uses Kaan's crisp context-call header (mockup 2) + context-call CTA", () => {
    // Kaan's July-10 rewrite: fixed headline, company moves into the subtitle.
    expect(c.heading).toBe("Company context call");
    expect((c as { subtitle?: string }).subtitle).toBe(
      "Build Nexus's first understanding of Marmara Hotel.",
    );
    expect(c.whatItIsTitle).toBe("What this is");
    expect(c.startAction).toBe("Begin the context call");
  });

  it("makes the honest attribution promise the founder is owed", () => {
    expect(c.handling).toContain(
      "What you share builds your company's snapshot and is attributed to you as its source.",
    );
    // Non-negotiable 2: nothing the CEO says reaches an interviewee, stated plainly.
    expect(
      c.handling.some((h) => /repeated to an employee/i.test(h)),
    ).toBe(true);
  });

  it("never shows the role-only respondent promise to the founder", () => {
    const all = [c.heading, c.intro, ...c.whatItIs, ...c.handling, c.consentFinePrint].join(" ");
    expect(all).not.toMatch(/shared by role/i);
    expect(all).not.toMatch(/performance review/i);
    expect(all).not.toMatch(/not by your name/i);
    expect(all).not.toMatch(/you won't be asked to rate anyone/i);
  });

  it("falls back to a neutral company in the subtitle when the name is absent", () => {
    const c2 = consentCopy(session({ context_call: true, context: { est_minutes: 30 } }));
    expect(c2.heading).toBe("Company context call");
    expect((c2 as { subtitle?: string }).subtitle).toBe(
      "Build Nexus's first understanding of your company.",
    );
  });
});
