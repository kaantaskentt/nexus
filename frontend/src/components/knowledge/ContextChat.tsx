"use client";

import { useState } from "react";
import { CornerDownLeft, Loader2, MessageCircleQuestion, PlusCircle } from "lucide-react";
import { ask_context, add_context, type ChatAnswer } from "@/lib/live";
import { ConfidenceBadge } from "@/components";
import { confidenceForTag } from "@/lib/trust";

// Context chat door (Kaan product ask, July 7): the #20 backend APIs finally get a UI.
// Ask: cited Q&A over the record store — every citation is a real retrieved record with
// its trust badge (never a hallucinated id; the backend enforces that). Add: an admin
// statement compiled through the STANDARD pipeline, capped at CLAIMED — it becomes
// comparable records, never a hand-edit of existing ones.
export function ContextChat({ workspaceId }: { workspaceId: string }) {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<ChatAnswer | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [statement, setStatement] = useState("");
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function ask(q?: string) {
    const text = (q ?? question).trim();
    if (!text || asking) return;
    if (q) setQuestion(q);
    setAsking(true);
    setAskError(null);
    try {
      setResult(await ask_context(workspaceId, text));
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "The question failed");
    } finally {
      setAsking(false);
    }
  }

  async function submitStatement() {
    if (!statement.trim() || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      await add_context(workspaceId, statement.trim());
      setAdded(true);
      setStatement("");
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Adding context failed");
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="mb-8 rounded-card border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <MessageCircleQuestion className="h-5 w-5 text-ink-faint" strokeWidth={1.5} />
        <h2 className="font-display text-lg text-ink">Ask the company context</h2>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
        Answers come only from the compiled records, cited with their trust level. What
        isn&apos;t in the records, it won&apos;t claim to know.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="e.g. Who touches an order before it ships?"
          className="flex-1 rounded-md border border-line bg-surface-sunken/40 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
        />
        <button
          type="button"
          onClick={() => ask()}
          disabled={!question.trim() || asking}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard enabled:hover:-translate-y-px enabled:hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {asking ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <CornerDownLeft className="h-4 w-4" strokeWidth={2} />
          )}
          Ask
        </button>
      </div>
      {askError && <p className="mt-2 text-xs text-danger">{askError}</p>}

      {result && (
        <div className="mt-4 space-y-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{result.answer}</p>
          {result.citations.length > 0 && (
            <ul className="space-y-2">
              {result.citations.map((c) => (
                <li
                  key={c.record_id}
                  className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-sunken/40 px-3 py-2"
                >
                  {c.tag && <ConfidenceBadge confidence={confidenceForTag(c.tag)} />}
                  <div className="min-w-0">
                    <p className="text-xs leading-snug text-ink">{c.claim_text}</p>
                    {c.evidence_quote && (
                      <p className="mt-0.5 truncate text-[11px] italic text-ink-faint">
                        &ldquo;{c.evidence_quote}&rdquo;
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {result.suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {/* Suggestions are {text, rationale} objects (prompt contract) — render the
                  text, carry the rationale as a tooltip. Rendering the object itself was
                  the July 8 white-screen (React #31). */}
              {result.suggestions.map((s) => (
                <button
                  key={s.text}
                  type="button"
                  onClick={() => ask(s.text)}
                  title={s.rationale ?? undefined}
                  className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
                >
                  {s.text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-line pt-3">
        {!addOpen ? (
          <button
            type="button"
            onClick={() => {
              setAddOpen(true);
              setAdded(false);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <PlusCircle className="h-3.5 w-3.5" strokeWidth={1.75} /> Add something the records
            are missing
          </button>
        ) : added ? (
          <p className="text-xs leading-relaxed text-ink-soft">
            Compiling. It lands as ordinary records capped at{" "}
            <span className="font-medium">Claimed</span> — comparable with everything else,
            never an edit of an existing record.{" "}
            <button
              type="button"
              onClick={() => setAdded(false)}
              className="font-medium text-accent-ink hover:underline"
            >
              Add more
            </button>
          </p>
        ) : (
          <div>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              rows={2}
              placeholder="State it plainly, as you'd tell a colleague. It compiles through the standard pipeline, capped at Claimed."
              className="w-full resize-y rounded-md border border-line bg-surface-sunken/40 px-3 py-2 text-xs text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
            />
            {addError && <p className="mt-1 text-xs text-danger">{addError}</p>}
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={submitStatement}
                disabled={!statement.trim() || adding}
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors enabled:hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                {adding && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />}
                Add as context
              </button>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="text-xs text-ink-soft hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
