import brand from "@/lib/brand";

// Workspace picker (A11.5 — no auth v1): seeded company cards, click to enter.
// Placeholder shell — the frontend teammate builds this against the mockup.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6">
      <h1 className="font-display text-5xl text-ink">{brand.product_name}</h1>
      <p className="text-ink-soft">
        A world-class interviewer and context extractor.
      </p>
      <div className="mt-4 rounded-card border border-line bg-surface p-6 shadow-card">
        <p className="text-sm text-ink-faint">
          Workspace picker renders here — seeded companies, is_demo badge on the
          demo tenant.
        </p>
      </div>
    </main>
  );
}
