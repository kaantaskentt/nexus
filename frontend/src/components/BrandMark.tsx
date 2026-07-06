// The Nexus mark — a four-point spark beside the wordmark (stage5/stage6 mockups).
// Config-neutral: it's the visual mark, not the name (the name lives in brand.ts).
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 1 14.1 9.9 23 12 14.1 14.1 12 23 9.9 14.1 1 12 9.9 9.9Z" />
    </svg>
  );
}
