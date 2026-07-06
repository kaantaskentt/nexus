// Content-only loading skeleton for every workspace screen (#31 / #8). The shell (nav +
// top bar) lives in the persistent layout, so this only fills the content slot: a slow
// SSR read (a Railway cold start) lands on a shimmering, shell-framed skeleton instead of
// a blank frame, and there is no nav flash because the nav never re-mounts.
export default function WorkspaceLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-8 py-10" aria-busy="true" aria-label="Loading">
      <div className="h-11 w-72 rounded-lg bg-surface-sunken" />
      <div className="mt-4 h-4 w-full max-w-xl rounded bg-surface-sunken" />
      <div className="mt-2 h-4 w-full max-w-md rounded bg-surface-sunken" />
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-card border border-line bg-surface shadow-elev-1" />
        ))}
      </div>
    </div>
  );
}
