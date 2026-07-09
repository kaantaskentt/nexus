"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FileUp, Loader2, Paperclip } from "lucide-react";
import { list_artifacts_by_token, upload_artifact, type RespondentArtifact } from "@/lib/live";

// Done-page promise list (Kaan F1, July 8): everything the respondent offered to send,
// with the upload RIGHT THERE — the promise the interviewer accepted gets honored on
// the very next screen. The scan lands seconds after completion, so we poll briefly;
// if nothing was promised (or the scan is still running), this renders nothing —
// the thank-you page never shows an empty apparatus.
const POLLS = 6;
const POLL_MS = 5000;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function PromisedArtifacts({ token }: { token: string }) {
  const [items, setItems] = useState<RespondentArtifact[]>([]);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    (async () => {
      for (let i = 0; i < POLLS; i++) {
        try {
          const list = await list_artifacts_by_token(token);
          if (!alive.current) return;
          if (list.length > 0) {
            setItems(list);
            return;
          }
        } catch {
          /* transient — keep polling quietly */
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (!alive.current) return;
      }
    })();
    return () => {
      alive.current = false;
    };
  }, [token]);

  if (items.length === 0) return null;

  return (
    <div className="mx-auto mt-8 max-w-md text-left">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Paperclip className="h-4 w-4 text-accent" strokeWidth={1.75} />
        You offered to share {items.length === 1 ? "something" : "a few things"}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
        No rush — you can add {items.length === 1 ? "it" : "them"} now, or come back to
        this same link later.
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((a) => (
          <ArtifactRow
            key={a.id}
            token={token}
            artifact={a}
            onDelivered={(id, name) =>
              setItems((list) =>
                list.map((x) => (x.id === id ? { ...x, status: "delivered", file_name: name } : x)),
              )
            }
          />
        ))}
      </ul>
    </div>
  );
}

function ArtifactRow({
  token,
  artifact,
  onDelivered,
}: {
  token: string;
  artifact: RespondentArtifact;
  onDelivered: (id: string, fileName: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("That file is over 10 MB. A smaller export works better here.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve((r.result as string).split(",", 2)[1] ?? "");
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      await upload_artifact(token, artifact.id, file.name, file.type || "application/octet-stream", b64);
      onDelivered(artifact.id, file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink">{artifact.item}</div>
          {artifact.objective_context && (
            <div className="mt-0.5 truncate text-xs text-ink-faint">
              Came up around: {artifact.objective_context}
            </div>
          )}
        </div>
        {artifact.status === "delivered" ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-chip bg-success-soft px-2.5 py-1 text-xs font-medium text-tag-verified">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            {artifact.file_name ?? "Received"}
          </span>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <FileUp className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            Upload
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
      />
    </li>
  );
}
