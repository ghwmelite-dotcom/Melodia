// ─── Types ─────────────────────────────────────────────────────────────────────

type LyricsDisplayProps = {
  lyrics: string | null;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

type LyricsToken =
  | { kind: "header"; text: string }
  | { kind: "line"; text: string }
  | { kind: "blank" };

const SECTION_HEADER_RE = /^\[(.+?)\]$/;

function parseLyrics(raw: string): LyricsToken[] {
  const tokens: LyricsToken[] = [];
  const lines = raw.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "") {
      tokens.push({ kind: "blank" });
      continue;
    }

    const match = SECTION_HEADER_RE.exec(trimmed);
    if (match) {
      tokens.push({ kind: "header", text: match[1] ?? trimmed });
    } else {
      tokens.push({ kind: "line", text: trimmed });
    }
  }

  return tokens;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function LyricsDisplay({ lyrics }: LyricsDisplayProps) {
  if (lyrics == null || lyrics.trim() === "") {
    return (
      <p className="text-gray-500 text-sm italic">Lyrics not available.</p>
    );
  }

  const tokens = parseLyrics(lyrics);

  return (
    <div className="space-y-0">
      {tokens.map((token, idx) => {
        if (token.kind === "header") {
          return (
            <p
              key={idx}
              className="text-amber font-semibold text-sm uppercase tracking-wide mt-6 mb-2"
            >
              {token.text}
            </p>
          );
        }

        if (token.kind === "blank") {
          // Render a small gap between stanzas but collapse multiple blanks
          const prevToken = tokens[idx - 1];
          if (!prevToken || prevToken.kind === "blank" || prevToken.kind === "header") {
            return null;
          }
          return <div key={idx} className="h-3" />;
        }

        // Regular lyrics line
        return (
          <p key={idx} className="text-gray-200 leading-relaxed text-sm">
            {token.text}
          </p>
        );
      })}
    </div>
  );
}
