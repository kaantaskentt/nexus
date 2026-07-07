"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Upload,
  FileText,
  Sparkles,
  Check,
  Loader2,
  AlertCircle,
  ArrowRight,
  Mic,
} from "lucide-react";
import { upload_discovery, discovery_status, type DiscoveryStatus } from "@/lib/live";
import { rise, staggerParent } from "@/lib/variants";
import { WebsiteScan } from "./WebsiteScan";
import brand from "@/lib/brand";

// Guided empty state + the demo moment (A17 / #6). A fresh company lands here: paste or
// drop the CEO discovery-call transcript, and Nexus runs the STANDARD compile pipeline,
// revealing each stage honestly (real job status, real record counts) until the snapshot
// renders. Nothing is faked — the progress board reads the jobs table.

// Pipeline stages in reveal order, with human labels. Kinds match the backend fan-out.
const STAGES: { kind: string; label: string }[] = [
  { kind: "compile_session", label: "Reading the transcript, extracting records" },
  { kind: "build_workflow_schema", label: "Mapping how the work actually flows" },
  { kind: "score_interview_quality", label: "Scoring what the call covered" },
  { kind: "rate_pain", label: "Rating where the pain is" },
  { kind: "score_heuristics", label: "Checking the early hunches" },
  { kind: "detect_conflicts", label: "Looking for contradictions" },
  { kind: "render_snapshot", label: "Composing the Company Snapshot" },
];

type Phase = "idle" | "compiling" | "done" | "error";

export function DiscoveryUpload({
  workspaceId,
  defaultSpeaker,
  website,
  hasRecords = false,
  append = false,
}: {
  workspaceId: string;
  defaultSpeaker?: string;
  website?: string;
  // True when the tenant already has raw records but no compiled snapshot cards (the
  // Aurora state): the heading must say that honestly instead of greeting a "fresh" start.
  hasRecords?: boolean;
  // Add-transcript-later door (Kaan, July 7): the snapshot already exists and this is a
  // LATER call compiling into the same record store. Compact heading, no first-time pitch.
  append?: boolean;
}) {
  const router = useRouter();
  const [transcript, setTranscript] = useState("");
  const [speaker, setSpeaker] = useState(defaultSpeaker ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<DiscoveryStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const readFile = useCallback((file: File) => {
    // Verbatim: we read the raw text and never transform it — hedges are data.
    const reader = new FileReader();
    reader.onload = () => {
      setTranscript(String(reader.result ?? ""));
      setFileName(file.name);
    };
    reader.readAsText(file);
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  }

  async function start() {
    if (!transcript.trim()) return;
    setPhase("compiling");
    setError(null);
    try {
      const { session_id } = await upload_discovery(
        workspaceId,
        transcript,
        speaker.trim() || undefined,
      );
      pollRef.current = setInterval(async () => {
        try {
          const s = await discovery_status(workspaceId, session_id);
          setStatus(s);
          if (s.state === "done") {
            if (pollRef.current) clearInterval(pollRef.current);
            setPhase("done");
            // api() is no-store, so the server re-render shows the fresh cards.
            setTimeout(() => router.refresh(), 900);
          } else if (s.state === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setError("The compile hit an error. The transcript is saved; you can retry.");
            setPhase("error");
          }
        } catch {
          // transient poll error — keep polling
        }
      }, 1200);
    } catch {
      setError("Could not start the compile. Check the API is reachable and try again.");
      setPhase("error");
    }
  }

  if (phase === "compiling" || phase === "done") {
    return <CompilingView status={status} done={phase === "done"} />;
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-16">
      <motion.div variants={rise} initial="hidden" animate="show" className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-ink ring-1 ring-inset ring-accent/20">
          <Mic className="h-7 w-7" strokeWidth={1.5} />
        </div>
        <h1 className="mt-6 font-display text-[2.5rem] leading-[1.1] text-ink">
          {append
            ? "Add a call transcript"
            : hasRecords
              ? "Your snapshot isn't built yet"
              : "Start with the CEO call"}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
          {append
            ? `A later call with the founder or team compiles into the same record store. ` +
              `New claims are compared with what's already here, never merged over it, and ` +
              `the snapshot updates when the new records land.`
            : hasRecords
              ? `Records from an earlier upload are saved, but no Company Snapshot has been ` +
                `compiled from them yet. Paste or drop a discovery-call transcript to build it.`
              : `Paste or drop the discovery-call transcript. ${brand.product_name} reads it the ` +
                `way a world-class interviewer would, and builds your first Company Snapshot from ` +
                `what was actually said.`}
        </p>

        {/* What will appear here — the guided preview of the three snapshot sections.
            Hidden on the append door: the admin has already seen the snapshot. */}
        <div className={append ? "hidden" : "mx-auto mt-6 grid max-w-lg grid-cols-1 gap-2 text-left sm:grid-cols-3"}>
          {[
            ["What Nexus Learned", "The company as described, each point tied to a quote"],
            ["Areas to Investigate", "Open questions and gaps worth an interview"],
            ["People to Interview", "Suggested roles, by what they can confirm"],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border border-dashed border-line-strong/70 bg-surface-sunken/50 px-3 py-2.5">
              <div className="text-xs font-semibold text-ink-soft">{t}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-ink-faint">{d}</div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        variants={rise}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.08 }}
        className="mt-8"
      >
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={
            "block cursor-text rounded-card border bg-surface p-1 shadow-elev-1 transition-colors " +
            (dragOver ? "border-accent" : "border-line")
          }
        >
          <textarea
            value={transcript}
            onChange={(e) => {
              setTranscript(e.target.value);
              setFileName(null);
            }}
            rows={10}
            placeholder={
              "Paste the transcript here, or drop a .txt / .md file.\n\n" +
              "Interviewer: Walk me through how the mornings usually start.\n" +
              "Alex: I check the new orders first, then sort out anything from the day before.\n" +
              "Interviewer: How long does that take?\n" +
              "Alex: An hour, on a good day. The returns are the real headache."
            }
            className="w-full resize-y rounded-md bg-transparent px-4 py-3 text-sm leading-relaxed text-ink outline-none placeholder:text-ink-faint/70"
          />
          <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-1">
            <FileButton onFile={readFile} fileName={fileName} />
            <span className="text-xs text-ink-faint">
              {transcript.trim() ? `${transcript.trim().split(/\s+/).length} words` : "verbatim, kept as-is"}
            </span>
          </div>
        </label>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
              Who gave the call
            </span>
            <input
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
              className="input"
              placeholder="Founder or CEO name"
            />
          </label>
          <button
            onClick={start}
            disabled={!transcript.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2} />
            Build the snapshot
          </button>
        </div>

        {error && (
          <p className="mt-4 flex items-center gap-2 rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
            {error}
          </p>
        )}

        {website && <WebsiteScan workspaceId={workspaceId} website={website} />}
      </motion.div>
    </div>
  );
}

function FileButton({
  onFile,
  fileName,
}: {
  onFile: (f: File) => void;
  fileName: string | null;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
      >
        {fileName ? (
          <>
            <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
            {fileName}
          </>
        ) : (
          <>
            <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
            Upload .txt / .md
          </>
        )}
      </button>
      <input
        ref={ref}
        type="file"
        accept=".txt,.md,text/plain,text/markdown"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </>
  );
}

// Honest progress board: each stage shows its real job status; records + cards tick up
// from the real counts. When the snapshot renders, the page refreshes to reveal it.
function CompilingView({ status, done }: { status: DiscoveryStatus | null; done: boolean }) {
  const byKind = new Map((status?.stages ?? []).map((s) => [s.kind, s.status]));

  return (
    <div className="mx-auto max-w-2xl px-8 py-16">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-ink ring-1 ring-inset ring-accent/20">
          {done ? (
            <Check className="h-7 w-7" strokeWidth={2} />
          ) : (
            <Loader2 className="h-7 w-7 animate-spin" strokeWidth={1.75} />
          )}
        </div>
        <h1 className="mt-6 font-display text-[2.5rem] leading-[1.1] text-ink">
          {done ? "Your snapshot is ready" : "Building your snapshot"}
        </h1>
        <p className="mt-3 text-sm text-ink-soft">
          {done
            ? "Bringing it in now."
            : "Reading the call and composing what was learned. This takes a moment."}
        </p>

        <div className="mt-6 flex items-center justify-center gap-6">
          <Counter value={status?.claims ?? 0} label="records captured" />
          <div className="h-8 w-px bg-line" />
          <Counter value={status?.cards ?? 0} label="snapshot cards" />
        </div>
      </div>

      <motion.ol
        variants={staggerParent}
        initial="hidden"
        animate="show"
        className="mx-auto mt-10 max-w-md space-y-1.5"
      >
        {STAGES.map((stage) => {
          const st = byKind.get(stage.kind) ?? "pending";
          const isDone = st === "done";
          const isActive = st === "running" || st === "queued";
          return (
            <motion.li
              key={stage.kind}
              variants={rise}
              className={
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors " +
                (isDone
                  ? "text-ink"
                  : isActive
                    ? "bg-surface-raised text-ink"
                    : "text-ink-faint")
              }
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                {isDone ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success-soft text-success">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin text-accent" strokeWidth={2} />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                )}
              </span>
              {stage.label}
            </motion.li>
          );
        })}
      </motion.ol>

      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 flex justify-center"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium text-accent">
              Opening your Company Snapshot
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Counter({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="tabular font-display text-3xl text-ink">{value}</div>
      <div className="text-xs text-ink-faint">{label}</div>
    </div>
  );
}
