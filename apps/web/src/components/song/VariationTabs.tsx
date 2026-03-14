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
    <div className="space-y-2">
      {/* Tab row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500 mr-1">
          Variations
        </span>

        {Array.from({ length: variationCount }, (_, i) => {
          const isActive = i === selectedIndex;
          const isPrimary = i === primaryIndex;

          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
              style={
                isActive
                  ? {
                      backgroundColor: "var(--color-amber)",
                      color: "var(--color-charcoal)",
                      fontWeight: 600,
                    }
                  : {
                      backgroundColor: "var(--color-surface-2)",
                      color: "#9ca3af",
                    }
              }
              aria-label={`Variation ${i + 1}${isPrimary ? " (primary)" : ""}`}
              aria-pressed={isActive}
            >
              {/* Star icon for primary */}
              {isPrimary && (
                <svg
                  className="w-3.5 h-3.5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  style={isActive ? {} : { color: "var(--color-amber)" }}
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              )}
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* "Set as primary" CTA — only visible when playing a non-primary variation */}
      {isPlayingNonPrimary && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            Playing variation {selectedIndex + 1}
          </span>
          <button
            onClick={() => onSetPrimary(selectedIndex)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: "rgba(240,165,0,0.12)",
              color: "var(--color-amber)",
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
