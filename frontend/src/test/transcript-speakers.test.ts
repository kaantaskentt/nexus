import { describe, expect, it } from "vitest";
import { detectSpeakers, applySpeakerMapping } from "@/lib/transcript-speakers";

// Speaker mapping (Kaan verdict 7): labels are detected and rewritten; the spoken text
// itself is never touched (verbatim rule).

const SAMPLE = [
  "Speaker 1: Mornings are all about the metal prices, everything waits on those.",
  "Speaker 2: Who handles the repricing?",
  "Speaker 1: Deniz does. Note: he keeps his own sheet.",
  "It was a follow-up remark with no label at all.",
].join("\n");

describe("detectSpeakers", () => {
  it("finds each label once, in order", () => {
    expect(detectSpeakers(SAMPLE)).toEqual(["Speaker 1", "Speaker 2"]);
  });

  it("ignores long pre-colon phrases (mid-sentence colons are not speakers)", () => {
    const text = "The thing we always said about the morning run: it never works.";
    expect(detectSpeakers(text)).toEqual([]);
  });
});

describe("applySpeakerMapping", () => {
  it("rewrites labels only, keeps text and unlabeled lines verbatim", () => {
    const out = applySpeakerMapping(SAMPLE, {
      "Speaker 1": "Kaan Taskent (CEO)",
      "Speaker 2": "Interviewer",
    });
    const lines = out.split("\n");
    expect(lines[0]).toBe(
      "Kaan Taskent (CEO): Mornings are all about the metal prices, everything waits on those.",
    );
    expect(lines[1]).toBe("Interviewer: Who handles the repricing?");
    // the "Note:" inside the utterance is untouched
    expect(lines[2]).toBe("Kaan Taskent (CEO): Deniz does. Note: he keeps his own sheet.");
    expect(lines[3]).toBe("It was a follow-up remark with no label at all.");
  });

  it("leaves unmapped or empty-mapped labels alone", () => {
    const out = applySpeakerMapping(SAMPLE, { "Speaker 2": "  " });
    expect(out).toBe(SAMPLE);
  });
});
