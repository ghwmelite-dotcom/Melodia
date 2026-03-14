import { useState, useEffect, useCallback, useRef } from "react";
import { useSongs } from "../../hooks/useSongs.js";
import type { RegenerateSongInput } from "@melodia/shared";

// ─── Types ─────────────────────────────────────────────────────────────────────

type KeepOption = RegenerateSongInput["keep"];

interface RegenerateModalProps {
  songId: string;
  isOpen: boolean;
  onClose: () => void;
  onRegenerated: () => void;
}

// ─── Radio options config ───────────────────────────────────────────────────────

const KEEP_OPTIONS: {
  value: KeepOption;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "lyrics",
    label: "Keep Lyrics",
    description: "Same words, new music and artwork",
    icon: "✍️",
  },
  {
    value: "blueprint",
    label: "Keep Blueprint",
    description: "Same song concept, new lyrics and music",
    icon: "🗺️",
  },
  {
    value: "none",
    label: "Fresh Start",
    description: "New blueprint, lyrics, music, and artwork",
    icon: "✨",
  },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export function RegenerateModal({
  songId,
  isOpen,
  onClose,
  onRegenerated,
}: RegenerateModalProps) {
  const songs = useSongs();
  const [keep, setKeep] = useState<KeepOption>("lyrics");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setKeep("lyrics");
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Trap focus within modal when open
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus();
    }
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await songs.regenerate(songId, keep);
      onRegenerated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [songs, songId, keep, onRegenerated, onClose]);

  if (!isOpen) return null;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={handleBackdropClick}
      role="presentation"
    >
      {/* Modal card */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="regenerate-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl outline-none overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #1e1e3c 0%, var(--color-surface-1) 100%)",
          border: "1px solid rgba(240,165,0,0.2)",
          boxShadow:
            "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 60px rgba(240,165,0,0.06)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Amber accent line at top */}
        <div
          style={{
            height: "2px",
            background: "linear-gradient(90deg, transparent 0%, var(--color-amber) 40%, var(--color-amber-light) 60%, transparent 100%)",
          }}
        />

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2
                id="regenerate-title"
                className="text-xl font-bold text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Regenerate Song
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Choose what to keep from the current version
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 transition-all duration-150"
              style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
              aria-label="Close"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.1)";
                (e.currentTarget as HTMLElement).style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.05)";
                (e.currentTarget as HTMLElement).style.color = "";
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Radio options */}
          <fieldset className="space-y-2.5">
            <legend className="sr-only">What would you like to keep?</legend>

            {KEEP_OPTIONS.map((option) => {
              const isSelected = keep === option.value;
              return (
                <label
                  key={option.value}
                  className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200"
                  style={{
                    background: isSelected
                      ? "linear-gradient(135deg, rgba(240,165,0,0.1) 0%, rgba(240,165,0,0.04) 100%)"
                      : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isSelected ? "rgba(240,165,0,0.35)" : "rgba(255,255,255,0.06)"}`,
                    boxShadow: isSelected ? "0 0 20px rgba(240,165,0,0.08)" : "none",
                  }}
                >
                  {/* Emoji icon */}
                  <span
                    className="text-xl shrink-0 w-9 h-9 flex items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: isSelected ? "rgba(240,165,0,0.15)" : "rgba(255,255,255,0.04)",
                    }}
                    aria-hidden="true"
                  >
                    {option.icon}
                  </span>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold"
                      style={{
                        color: isSelected ? "var(--color-amber-light)" : "#e2e8f0",
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      {option.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                  </div>

                  {/* Custom radio indicator */}
                  <div
                    className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200"
                    style={{
                      border: `2px solid ${isSelected ? "var(--color-amber)" : "rgba(255,255,255,0.2)"}`,
                      backgroundColor: isSelected ? "var(--color-amber)" : "transparent",
                    }}
                  >
                    {isSelected && (
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: "var(--color-charcoal)" }}
                      />
                    )}
                  </div>

                  {/* Hidden real radio */}
                  <input
                    type="radio"
                    name="keep"
                    value={option.value}
                    checked={isSelected}
                    onChange={() => setKeep(option.value)}
                    className="sr-only"
                  />
                </label>
              );
            })}
          </fieldset>

          {/* Credit notice */}
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
              background: "rgba(240,165,0,0.07)",
              border: "1px solid rgba(240,165,0,0.15)",
            }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(240,165,0,0.15)" }}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                style={{ color: "var(--color-amber)" }}
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: "var(--color-amber-light)" }}>
              This will use <strong>1 credit</strong>
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                background: "rgba(231,76,60,0.1)",
                border: "1px solid rgba(231,76,60,0.25)",
                color: "var(--color-coral)",
              }}
            >
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-50"
              style={{
                backgroundColor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#9ca3af",
                fontFamily: "var(--font-display)",
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.08)";
                  (e.currentTarget as HTMLElement).style.color = "#fff";
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.05)";
                (e.currentTarget as HTMLElement).style.color = "#9ca3af";
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background: isSubmitting
                  ? "rgba(240,165,0,0.5)"
                  : "linear-gradient(135deg, var(--color-amber) 0%, #D4920A 100%)",
                color: "var(--color-charcoal)",
                boxShadow: isSubmitting ? "none" : "0 4px 20px rgba(240,165,0,0.35)",
                fontFamily: "var(--font-display)",
              }}
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Regenerating…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Regenerate
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
