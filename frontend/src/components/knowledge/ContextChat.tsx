"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CornerDownLeft, Loader2, MessageCircleQuestion, PlusCircle } from "lucide-react";
import { ask_context, add_context, type ChatAnswer, type ChatCitation } from "@/lib/live";
import { ConfidenceBadge } from "@/components";
import { confidenceForTag } from "@/lib/trust";

// Context chat door (Kaan product ask, July 7): the #20 backend APIs finally get a UI.
// Ask: cited Q&A over the record store — every citation is a real retrieved record with
// its trust badge (never a hallucinated id; the backend enforces that). Add: an admin
// statement compiled through the STANDARD pipeline, capped at CLAIMED — it becomes
// comparable records, never a hand-edit of existing ones.

type IndexedCitation = ChatCitation & { n: number; label: string };

function indexCitations(citations: ChatCitation[]): IndexedCitation[] {
  return citations.map((c, i) => ({ ...c, n: i + 1, label: `C${i + 1}` }));
}

function resolveCitation(
  token: string,
  indexed: IndexedCitation[],
): IndexedCitation | null {
  const needle = token.replace(/-/g, "").toLowerCase();
  if (!needle) return null;
  return (
    indexed.find((c) => {
      const compact = c.record_id.replace(/-/g, "").toLowerCase();
      return (
        compact === needle ||
        compact.startsWith(needle) ||
        needle.startsWith(compact.slice(0, Math.min(8, compact.length)))
      );
    }) ?? null
  );
}

// Models often paste `(record <uuid-or-prefix>)` into the answer prose. Turn those into
// numbered chips that map onto the citation list below (never invent ids the API didn't
// return — unresolved markers stay as plain text).
const INLINE_CITATION_RE = /\(record\s+([0-9a-fA-F-]{6,36})\)/gi;

function CitedAnswer({
  answer,
  citations,
}: {
  answer: string;
  citations: IndexedCitation[];
}) {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  INLINE_CITATION_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_CITATION_RE.exec(answer)) !== null) {
    if (match.index > last) {
      parts.push(<span key={key++}>{answer.slice(last, match.index)}</span>);
    }
    const hit = resolveCitation(match[1], citations);
    parts.push(
      hit ? (
        <CitationChip key={key++} citation={hit} />
      ) : (
        <span key={key++}>{match[0]}</span>
      ),
    );
    last = match.index + match[0].length;
  }
  if (last < answer.length) {
    parts.push(<span key={key++}>{answer.slice(last)}</span>);
  }
  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{parts}</p>;
}

const PREVIEW_WIDTH = 288; // w-72
const PREVIEW_PAD = 12;

function CitationChip({ citation }: { citation: IndexedCitation }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
    placeAbove: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    const width = Math.min(PREVIEW_WIDTH, window.innerWidth - PREVIEW_PAD * 2);
    const maxLeft = window.innerWidth - width - PREVIEW_PAD;
    const left = Math.max(PREVIEW_PAD, Math.min(rect.left, maxLeft));
    // Prefer below the chip; flip above when there isn't room under it.
    const placeAbove = rect.bottom + 180 > window.innerHeight && rect.top > 180;
    const top = placeAbove ? rect.top - 6 : rect.bottom + 6;
    setPos({ top, left, width, placeAbove });
  }, [open]);

  return (
    <span
      className="relative mx-0.5 inline-block align-baseline"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={anchorRef}
        type="button"
        aria-label={`Citation ${citation.label}`}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex translate-y-[-1px] items-center rounded-chip border border-accent/35 bg-accent-soft px-1.5 py-px text-[10px] font-semibold tracking-tight text-accent-ink transition-colors hover:border-accent/60"
      >
        {citation.label}
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            role="tooltip"
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              transform: pos.placeAbove ? "translateY(-100%)" : undefined,
            }}
            className="fixed z-50 rounded-card border border-line bg-surface p-3 text-left shadow-elev-2"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-accent-ink">[{citation.label}]</span>
              {citation.tag ? (
                <ConfidenceBadge confidence={confidenceForTag(citation.tag)} />
              ) : null}
            </div>
            <p className="mt-1.5 text-xs leading-snug text-ink">{citation.claim_text}</p>
            {citation.evidence_quote && (
              <p className="mt-2 border-t border-line pt-2 text-[11px] italic leading-relaxed text-ink-soft">
                &ldquo;{citation.evidence_quote}&rdquo;
              </p>
            )}
          </div>,
          document.body,
        )}
    </span>
  );
}

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

  const indexed = result ? indexCitations(result.citations) : [];

  return (
    <section className="rounded-card border border-line bg-surface p-5">
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
          <CitedAnswer answer={result.answer} citations={indexed} />
          {indexed.length > 0 && (
            <ul className="space-y-2">
              {indexed.map((c) => (
                <li
                  key={c.record_id}
                  className="rounded-lg border border-line bg-surface-sunken/40 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-accent-ink">[{c.label}]</span>
                    {c.tag && <ConfidenceBadge confidence={confidenceForTag(c.tag)} />}
                  </div>
                  <p className="mt-1.5 text-xs leading-snug text-ink">{c.claim_text}</p>
                  {c.evidence_quote && (
                    <p className="mt-2 border-t border-line/80 pt-2 text-[11px] italic leading-relaxed text-ink-soft">
                      &ldquo;{c.evidence_quote}&rdquo;
                    </p>
                  )}
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
