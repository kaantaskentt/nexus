// Speaker mapping (Kaan verdict 7, July 7): detect the labels in a "Name: text"
// transcript so the admin can confirm who is who BEFORE compile — the confirmed names
// feed the compiler with correct speaker roles. Detection mirrors the backend parser's
// speaker-line shape (a short label before a colon); pure, and it never touches the
// spoken text itself (verbatim rule).

export function detectSpeakers(text: string): string[] {
  const seen: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([^:\n]{1,60}?):\s+\S/);
    if (!m) continue;
    const label = m[1].trim();
    if (label.split(/\s+/).length > 4) continue; // a colon mid-sentence, not a speaker
    if (!seen.includes(label)) seen.push(label);
  }
  return seen;
}

export function applySpeakerMapping(text: string, mapping: Record<string, string>): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const m = line.match(/^(\s*)([^:\n]{1,60}?)(:\s+)(.*)$/);
      if (!m) return line;
      const label = m[2].trim();
      if (label.split(/\s+/).length > 4) return line;
      const mapped = mapping[label]?.trim();
      return mapped && mapped !== label ? `${m[1]}${mapped}${m[3]}${m[4]}` : line;
    })
    .join("\n");
}
