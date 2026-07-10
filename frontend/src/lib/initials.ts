// Two-letter uppercase initials from the first two words of a name, shared by the avatar
// chips across the app. `fallback` is returned when the name yields nothing (empty or
// whitespace) — callers that showed "?" for an unknown name pass it; the rest default to "".
export function initials(name: string, fallback = ""): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || fallback
  );
}
