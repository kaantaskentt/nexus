// Display-layer polish for spoken transcripts (P0-B, July 7 night). STORAGE STAYS
// VERBATIM — these run only at render time. Two problems from Kaan's test call:
// (1) TTS/transcriber chunking renders one micro-bubble per fragment ("Day to day," /
//     "the real version" / "not the tidy 1.") — merge consecutive same-speaker chunks
//     into one coherent bubble per turn.
// (2) the transcriber writes small numbers as digits ("tidy 1", "1 quick note") which
//     reads wrong for spoken words — display standalone 0-10 as words. Larger numbers
//     ("30 minutes") stay digits, and digits attached to punctuation/units ("1,000",
//     "9:15", "3%") are left alone.

const SMALL_NUMBERS = [
  "zero", "one", "two", "three", "four", "five",
  "six", "seven", "eight", "nine", "ten",
];

export function displaySpokenText(text: string): string {
  return text.replace(
    /(?<![\d.,:%€$£-])\b(10|[0-9])\b(?![\d.,:%-])/g,
    (m) => SMALL_NUMBERS[Number(m)] ?? m,
  );
}

export function mergeTurns<T extends { role: string; text: string }>(turns: T[]): T[] {
  const out: T[] = [];
  for (const t of turns) {
    const last = out[out.length - 1];
    if (last && last.role === t.role) {
      out[out.length - 1] = { ...last, text: `${last.text} ${t.text}`.replace(/\s+/g, " ") };
    } else {
      out.push({ ...t });
    }
  }
  return out;
}
