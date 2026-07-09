import { describe, it, expect } from "vitest";
import { foldText } from "@/lib/fold";

// Emre doc-2 P1: searching "yildirim" returned 0 records though many contain "yıldırım".
// The fold must make ASCII queries match Turkish text and Turkish queries match either.
describe("foldText", () => {
  it("folds the Turkish repertoire both directions", () => {
    expect(foldText("yıldırım")).toBe("yildirim"); // the exact reported case
    expect(foldText("YILDIRIM")).toBe("yildirim"); // dotted-I capital path
    expect(foldText("İstanbul")).toBe("istanbul");
    expect(foldText("şğüöç")).toBe("sguoc");
  });

  it("query and haystack meet in the same folded space", () => {
    const hay = foldText("The log tab is there for yıldırım price questions");
    expect(hay.includes(foldText("yildirim"))).toBe(true);
    expect(hay.includes(foldText("YILDIRIM"))).toBe(true);
    expect(hay.includes(foldText("yıldırım"))).toBe(true);
  });

  it("handles general Latin diacritics and leaves plain ASCII alone", () => {
    expect(foldText("café naïve Zürich")).toBe("cafe naive zurich");
    expect(foldText("plain ascii 123")).toBe("plain ascii 123");
  });
});
