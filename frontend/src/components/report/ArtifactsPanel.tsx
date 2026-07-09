"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, Paperclip } from "lucide-react";
import { session_artifacts, type SessionArtifacts, type AdminArtifactPromise } from "@/lib/live";
import { browserAccessToken } from "@/lib/session";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// The download carries the admin JWT (a bare <a href> can't), then hands the browser a
// blob URL so the file saves under its real name.
async function downloadFile(workspaceId: string, p: AdminArtifactPromise) {
  const token = await browserAccessToken();
  const res = await fetch(`${API}/api/artifacts/${workspaceId}/file/${p.id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = p.file_name ?? "artifact";
  a.click();
  URL.revokeObjectURL(url);
}

// Promised-vs-delivered per session (Kaan F1, July 8). Delivered files download with
// their objective context attached — the artifact stays linked to WHY it was asked for.
// The reminder is copy-to-clipboard only: auto-send stays PROPOSED (no email/WhatsApp
// infra), so the human sends it on whatever channel the relationship already uses.
export function ArtifactsPanel({
  workspaceId,
  sessionId,
}: {
  workspaceId: string;
  sessionId: string;
}) {
  const [data, setData] = useState<SessionArtifacts | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    session_artifacts(workspaceId, sessionId)
      .then((d) => alive && setData(d))
      .catch(() => {
        /* panel hides on failure — the report never blocks on this */
      });
    return () => {
      alive = false;
    };
  }, [workspaceId, sessionId]);

  if (!data || data.promises.length === 0) return null;

  const delivered = data.promises.filter((p) => p.status === "delivered").length;

  function reminderFor(item: string): string {
    const name = data?.interviewee ? `Hi ${data.interviewee}` : "Hi";
    const link = data?.invite_path ? `${window.location.origin}${data.invite_path}` : "";
    return (
      `${name}, thank you again for the conversation. You mentioned you'd share ` +
      `${item} — you can add it right on your interview page${link ? `: ${link}` : ""}. ` +
      `It takes a minute and genuinely helps.`
    );
  }

  async function copyReminder(id: string, item: string) {
    try {
      await navigator.clipboard.writeText(reminderFor(item));
      setCopied(id);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard denied — the text is still visible in the title attr */
    }
  }

  return (
    <section className="card-hairline rounded-card border border-line bg-surface p-5">
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg text-ink">
        <Paperclip className="h-[18px] w-[18px] text-accent" strokeWidth={1.75} />
        Promised materials
      </h2>
      <p className="mb-3 text-xs text-ink-soft">
        {delivered} of {data.promises.length} delivered
      </p>
      <ul className="space-y-2.5">
        {data.promises.map((p) => (
          <li key={p.id} className="rounded-lg border border-line bg-surface-sunken/50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">{p.item}</div>
                {p.objective_context && (
                  <div className="mt-0.5 text-xs text-ink-faint">
                    Asked for under: {p.objective_context}
                  </div>
                )}
                {p.quote && (
                  <p className="mt-1 border-l-2 border-line pl-2 text-xs italic text-ink-soft">
                    &ldquo;{p.quote}&rdquo;
                  </p>
                )}
              </div>
              {p.status === "delivered" ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-chip bg-success-soft px-2 py-0.5 text-[11px] font-medium text-tag-verified">
                  <Check className="h-3 w-3" strokeWidth={2.5} /> Delivered
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center rounded-chip bg-pain-moderate px-2 py-0.5 text-[11px] font-medium text-tag-guess">
                  Promised
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              {p.status === "delivered" ? (
                <button
                  onClick={() => downloadFile(workspaceId, p)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:border-line-strong"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {p.file_name ?? "Download"}
                  {p.file_size > 0 && (
                    <span className="text-ink-faint">({Math.max(1, Math.round(p.file_size / 1024))} KB)</span>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => copyReminder(p.id, p.item)}
                  title={typeof window === "undefined" ? undefined : reminderFor(p.item)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:border-line-strong"
                >
                  {copied === p.id ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-tag-verified" strokeWidth={2.5} /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" strokeWidth={1.75} /> Copy reminder
                    </>
                  )}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
