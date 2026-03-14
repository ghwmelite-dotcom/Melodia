// ─── VariationTabs ─────────────────────────────────────────────────────────────
//
// Displays numbered variation buttons for a song with multi-variation support.
// Active (playing) tab is amber; the primary/starred variation shows a star icon.
// "Set as primary" CTA appears when the playing variation differs from primary.
// Hidden entirely when variationCount <= 1.

type VariationTabsProps = {
  variationCount: number;
  /** Currently playing variation (0-based index) */
  selectedIndex: number;
  /** The saved/primary variation (0-based index) */
  primaryIndex: number;
  onSelect: (index: number) => void;
  onSetPrimary: (index: number) => void;
};

export function VariationTabs({
  variationCount,
  selectedIndex,
  primaryIndex,
  onSelect,
  onSetPrimary,
}: VariationTabsProps) {
  if (variationCount <= 1) return null;

  const isPlayingNonPrimary = selectedIndex !== primaryIndex;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <span
          className="text-xs font-semibold uppercase tracking-widest"
          style={{
            color: "rgba(156,163,175,0.7)",
            fontFamily: "var(--font-display)",
            letterSpacing: "0.1em",
          }}
        >
          Variations
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: "linear-gradient(to right, rgba(240,165,0,0.15), transparent)" }}
        />
      </div>

      {/* Tab row */}
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: variationCount }, (_, i) => {
          const isActive = i === selectedIndex;
          const isPrimary = i === primaryIndex;

          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2"
              style={
                isActive
                  ? {
                      background: "linear-gradient(135deg, var(--color-amber) 0%, #D4920A 100%)",
                      color: "var(--color-charcoal)",
                      boxShadow: "0 4px 16px rgba(240,165,0,0.35), 0 1px 0 rgba(255,255,255,0.15) inset",
                      transform: "translateY(-1px)",
                      fontFamily: "var(--font-display)",
                    }
                  : {
                      backgroundColor: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#9ca3af",
                      fontFamily: "var(--font-display)",
                    }
              }
              aria-label={`Variation ${i + 1}${isPrimary ? " (primary)" : ""}`}
              aria-pressed={isActive}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(240,165,0,0.25)";
                  (e.currentTarget as HTMLElement).style.color = "#fff";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
                  (e.currentTarget as HTMLElement).style.color = "#9ca3af";
                }
              }}
            >
              {/* Star badge for primary */}
              {isPrimary && (
                <svg
                  className="w-3 h-3 shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  style={isActive ? { color: "rgba(15,15,26,0.7)" } : { color: "var(--color-amber)" }}
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              )}
              <span>V{i + 1}</span>
            </button>
          );
        })}
      </div>

      {/* "Set as primary" CTA */}
      {isPlayingNonPrimary && (
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{
            background: "rgba(240,165,0,0.05)",
            border: "1px solid rgba(240,165,0,0.12)",
          }}
        >
          <span
            className="text-xs"
            style={{ color: "rgba(156,163,175,0.8)", fontFamily: "var(--font-body)" }}
          >
            Playing Variation {selectedIndex + 1}
          </span>
          <button
            onClick={() => onSetPrimary(selectedIndex)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 hover:scale-105"
            style={{
              background: "linear-gradient(135deg, rgba(240,165,0,0.2) 0%, rgba(240,165,0,0.1) 100%)",
              border: "1px solid rgba(240,165,0,0.3)",
              color: "var(--color-amber)",
              fontFamily: "var(--font-display)",
            }}
          >
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Set as primary
          </button>
        </div>
      )}
    </div>
  );
}
