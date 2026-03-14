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
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <span style={{ fontSize: "2rem", opacity: 0.25 }}>♪</span>
        <p className="text-gray-500 text-sm italic">Lyrics not available.</p>
      </div>
    );
  }

  const tokens = parseLyrics(lyrics);

  return (
    <div
      className="relative"
      style={{
        maxHeight: "420px",
        overflowY: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {/* Gradient fade at bottom */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-10"
        style={{
          height: "72px",
          background: "linear-gradient(to bottom, transparent, var(--color-surface-1))",
        }}
        aria-hidden="true"
      />

      <div className="space-y-0 pb-12">
        {tokens.map((token, idx) => {
          if (token.kind === "header") {
            return (
              <div key={idx} className="mt-7 mb-3 first:mt-0">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest"
                  style={{
                    background: "linear-gradient(135deg, rgba(240,165,0,0.18) 0%, rgba(255,209,102,0.10) 100%)",
                    border: "1px solid rgba(240,165,0,0.28)",
                    color: "var(--color-amber-light)",
                    fontFamily: "var(--font-display)",
                    letterSpacing: "0.12em",
                  }}
                >
                  <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>♪</span>
                  {token.text}
                </span>
              </div>
            );
          }

          if (token.kind === "blank") {
            const prevToken = tokens[idx - 1];
            if (!prevToken || prevToken.kind === "blank" || prevToken.kind === "header") {
              return null;
            }
            return <div key={idx} className="h-4" />;
          }

          // Regular lyrics line
          return (
            <p
              key={idx}
              className="text-gray-200 text-sm transition-colors duration-150 rounded-md px-1 -mx-1 cursor-default"
              style={{
                lineHeight: "1.85",
                fontFamily: "var(--font-body)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(240,165,0,0.06)";
                (e.currentTarget as HTMLElement).style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "";
                (e.currentTarget as HTMLElement).style.color = "";
              }}
            >
              {token.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}
