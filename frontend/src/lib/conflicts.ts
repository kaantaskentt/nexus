// Conflict-kind labels — one plain-language name per detected conflict kind, shared by
// the Insights surface and the post-interview report. The pipeline emits kinds beyond
// the original three (now_vs_prior, a correction over time), so an unmapped kind is
// humanized rather than dropped. `accent` marks the disagreements worth foregrounding.
const CONFLICT_KIND_META: Record<string, { label: string; accent: boolean }> = {
  ceo_vs_floor: { label: "CEO vs floor", accent: true },
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
