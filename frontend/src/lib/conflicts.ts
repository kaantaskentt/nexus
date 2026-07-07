// Conflict-kind labels — one plain-language name per detected conflict kind, shared by
// the Insights surface and the post-interview report. The pipeline emits kinds beyond
// the original three (now_vs_prior, a correction over time), so an unmapped kind is
// humanized rather than dropped. `accent` marks the disagreements worth foregrounding.
const CONFLICT_KIND_META: Record<string, { label: string; accent: boolean }> = {
  // Collaborative framing: this is a perception gap to close together, not a verdict on
  // the founder. Reads on both the Insights surface and the founder-facing report.
  ceo_vs_floor: { label: "Leadership and floor view", accent: true },
  worker_vs_worker: { label: "Worker vs worker", accent: true },
  perception_gap: { label: "Perception gap", accent: true },
  now_vs_prior: { label: "Correction over time", accent: false },
};

export function conflictKindMeta(kind: string): { label: string; accent: boolean } {
  return (
    CONFLICT_KIND_META[kind] ?? {
      label: kind.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
      accent: false,
    }
  );
}
