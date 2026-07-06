// The Nexus mark — a four-point spark beside the wordmark (stage5/stage6 mockups).
// Config-neutral: it's the visual mark, not the name (the name lives in brand.ts).
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 1.5C12.6 6.9 17.1 11.4 22.5 12 17.1 12.6 12.6 17.1 12 22.5 11.4 17.1 6.9 12.6 1.5 12 6.9 11.4 11.4 6.9 12 1.5Z" />
    </svg>
  );
}
