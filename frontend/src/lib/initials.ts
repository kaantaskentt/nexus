// Two-letter uppercase initials from the first two words of a name, shared by the avatar
// chips across the app. Nullish / empty names return `fallback` — callers that showed "?"
// for an unknown name pass it; the rest default to "". Snapshot who_holds can ship with
// name: null (role-only), so this must never throw on .split.
export function initials(
  name: string | null | undefined,
  fallback = "",
): string {
  const safe = typeof name === "string" ? name.trim() : "";
  if (!safe) return fallback;
  return (
    safe
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || fallback
  );
}
