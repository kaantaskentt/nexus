import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContextChat } from "@/components/knowledge/ContextChat";
import type { ChatAnswer } from "@/lib/live";

// July 8 crash report #1: asking a question white-screened the app — suggestions come
// back as {text, rationale} objects (the prompt contract since #20) and the component
// rendered the object itself as a React child (error #31). This suite pins the render
// path with the REAL payload shape.
//
// Harness notes (vitest 2.1 + RTL 16, established by bisection during the July 8 shift):
// no `act(...)` wrappers (async settling is awaited via find* queries) and NO beforeEach
// hook on the mock — with any beforeEach registered here, an error thrown by the mocked
// ask_context was re-attributed to the test as a failure even though the component
// caught it and rendered its honest error line. Each test sets its own implementation;
// mockResolvedValue overrides fully, so no per-test reset is needed.

vi.mock("@/lib/live", () => ({ ask_context: vi.fn(), add_context: vi.fn() }));
import { ask_context } from "@/lib/live";
const askMock = vi.mocked(ask_context);

function answer(over: Partial<ChatAnswer> = {}): ChatAnswer {
  return {
    answer:
      "Burak reprices every morning on his personal Excel (record a1b2c3d4).",
    citations: [
      {
        record_id: "a1b2c3d4-0000-4000-8000-000000000001",
        tag: "CLAIMED",
        claim_text: "Burak runs the repricing.",
        evidence_quote: "I do the prices before anyone gets in",
        topic: "process_step",
      },
    ],
    suggestions: [
      { text: "Who checks the repriced numbers?", rationale: "no verification step in the records" },
      { text: "What happens when Burak is away?", rationale: "single-owner risk" },
    ],
    ...over,
  };
}

function askQuestion(text = "Who owns repricing?") {
  fireEvent.change(screen.getByPlaceholderText(/who touches an order/i), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: /^ask$/i }));
}

describe("ContextChat", () => {
  it("renders the answer plus object-shaped suggestions without crashing", async () => {
    askMock.mockResolvedValue(answer());
    render(<ContextChat workspaceId="ws-1" />);
    askQuestion();

    expect(await screen.findByText(/reprices every morning/i)).toBeInTheDocument();
    // Suggestion chips show the text and carry the rationale as a tooltip.
    const chip = screen.getByRole("button", { name: "Who checks the repriced numbers?" });
    expect(chip).toHaveAttribute("title", "no verification step in the records");
  });

  it("clicking a suggestion asks it as the next question", async () => {
    askMock.mockResolvedValue(answer());
    render(<ContextChat workspaceId="ws-1" />);
    askQuestion();

    const chip = await screen.findByRole("button", { name: "What happens when Burak is away?" });
    askMock.mockResolvedValue(answer({ suggestions: [] }));
    fireEvent.click(chip);
    await screen.findByText(/reprices every morning/i);
    expect(askMock).toHaveBeenLastCalledWith("ws-1", "What happens when Burak is away?");
  });

  it("shows citations with their trust badge and quote", async () => {
    askMock.mockResolvedValue(answer());
    render(<ContextChat workspaceId="ws-1" />);
    askQuestion();

    expect(await screen.findByText("Burak runs the repricing.")).toBeInTheDocument();
    expect(screen.getByText(/before anyone gets in/i)).toBeInTheDocument();
    expect(screen.getByText("Reported")).toBeInTheDocument(); // CLAIMED renders as Reported
    // Inline `(record …)` becomes a numbered chip; the source card carries [C1].
    expect(screen.getByRole("button", { name: /citation c1/i })).toBeInTheDocument();
    expect(screen.getByText("[C1]")).toBeInTheDocument();
    expect(screen.queryByText(/\(record a1b2c3d4\)/i)).not.toBeInTheDocument();
  });

  it("shows an honest error line when the ask fails, keeping the page alive", async () => {
    askMock.mockImplementation(() => {
      throw new Error("boom: backend unreachable");
    });
    render(<ContextChat workspaceId="ws-1" />);
    askQuestion();
    // The component surfaces e.message as the honest error line; the page stays alive.
    expect(await screen.findByText(/backend unreachable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^ask$/i })).toBeInTheDocument();
  });
});
