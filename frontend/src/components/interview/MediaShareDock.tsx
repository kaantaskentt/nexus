"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Paperclip,
  MonitorUp,
  Loader2,
  X,
  Circle,
} from "lucide-react";
import {
  completeMediaShare,
  createMediaShare,
  discardMediaShare,
  listMediaShares,
  shareFileOrScreenshot,
  uploadMediaShare,
  type MediaShare,
} from "@/lib/respondent";

// Mid-interview share door (file / screenshot / screen). Status chips only — never
// extraction prose (R1). Screen share: respondent starts and stops; OS picker is consent.

function statusLabel(s: MediaShare): string {
  if (s.status === "uploading") return "Uploading";
  if (s.status === "extracting") return "Extracting";
  if (s.status === "ready") return "Ready";
  if (s.status === "failed") return s.error ? `Failed` : "Failed";
  return s.status;
}

export function MediaShareDock({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState<MediaShare[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const shareIdRef = useRef<string | null>(null);

  async function refresh() {
    try {
      const list = await listMediaShares(token);
      setShares(list);
    } catch {
      /* poll soft-fails */
    }
  }

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, 4000);
    return () => clearInterval(id);
  }, [token]);

  async function onFile(file: File | null, kind: "file" | "screenshot") {
    if (!file) return;
    setBusy(kind);
    setError(null);
    setOpen(false);
    try {
      await shareFileOrScreenshot(token, kind, file, file.name, file.type || "application/octet-stream");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function captureScreenshot() {
    setBusy("screenshot");
    setError(null);
    setOpen(false);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" } as MediaTrackConstraints,
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      // One frame after the track is live.
      await new Promise((r) => setTimeout(r, 200));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not capture frame");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      track.stop();
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
      if (!blob) throw new Error("Could not capture screenshot");
      await shareFileOrScreenshot(
        token,
        "screenshot",
        blob,
        `screenshot-${Date.now()}.png`,
        "image/png",
      );
      await refresh();
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        setError(null); // user cancelled picker — not an error
      } else {
        setError(e instanceof Error ? e.message : "Screenshot failed");
      }
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      setBusy(null);
    }
  }

  async function startScreenShare() {
    setError(null);
    setOpen(false);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      const row = await createMediaShare(token, {
        kind: "screen",
        file_name: `screen-${Date.now()}.webm`,
        file_mime: "video/webm",
      });
      shareIdRef.current = row.id;
      setSharing(true);
      await refresh();

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        void stopScreenShare();
      });

      rec.start(2000);
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        setError(null);
      } else {
        setError(e instanceof Error ? e.message : "Screen share failed");
      }
      setSharing(false);
    }
  }

  async function stopScreenShare() {
    const rec = recorderRef.current;
    const shareId = shareIdRef.current;
    recorderRef.current = null;
    setSharing(false);
    setBusy("screen");
    try {
      if (rec && rec.state !== "inactive") {
        await new Promise<void>((resolve) => {
          rec.onstop = () => resolve();
          rec.stop();
        });
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (!shareId) return;
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      chunksRef.current = [];
      if (blob.size === 0) {
        await discardMediaShare(token, shareId);
        setError("Nothing was recorded");
        await refresh();
        return;
      }
      const content_base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const i = result.indexOf(",");
          resolve(i >= 0 ? result.slice(i + 1) : result);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      await uploadMediaShare(token, shareId, content_base64, false);
      await completeMediaShare(token, shareId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish screen share");
      if (shareId) {
        try {
          await discardMediaShare(token, shareId);
        } catch {
          /* ignore */
        }
      }
    } finally {
      shareIdRef.current = null;
      setBusy(null);
    }
  }

  const active = shares.filter((s) => s.status !== "discarded");

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            disabled={Boolean(busy) || sharing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
            aria-expanded={open}
            aria-label="Share file, screenshot, or screen"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Paperclip className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            Share
          </button>
          {open && (
            <div className="absolute bottom-full left-0 z-30 mb-1.5 w-52 rounded-card border border-line bg-surface p-1 shadow-elev-2">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink hover:bg-surface-sunken"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.75} />
                File
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink hover:bg-surface-sunken"
                onClick={() => void captureScreenshot()}
              >
                <Camera className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.75} />
                Screenshot
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink hover:bg-surface-sunken"
                onClick={() => void startScreenShare()}
              >
                <MonitorUp className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.75} />
                Share screen
              </button>
            </div>
          )}
        </div>

        {sharing && (
          <button
            type="button"
            onClick={() => void stopScreenShare()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-danger/40 bg-danger-soft px-2.5 py-1.5 text-xs font-semibold text-danger"
          >
            <Circle className="h-2.5 w-2.5 fill-current" strokeWidth={0} />
            You&apos;re sharing — Stop
          </button>
        )}

        {active.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 rounded-chip bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-soft"
            title={s.file_name ?? s.kind}
          >
            {(s.status === "uploading" || s.status === "extracting") && (
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
            )}
            {statusLabel(s)}
            {s.status !== "ready" && s.status !== "failed" && (
              <button
                type="button"
                aria-label="Discard"
                className="ml-0.5 text-ink-faint hover:text-ink"
                onClick={() => void discardMediaShare(token, s.id).then(refresh)}
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            )}
          </span>
        ))}
      </div>

      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.doc,.docx,.xls,.xlsx,image/*,application/pdf,text/*"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = "";
          void onFile(f, "file");
        }}
      />
    </div>
  );
}
