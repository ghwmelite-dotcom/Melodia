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

const KEEP_OPTIONS: { value: KeepOption; label: string; description: string }[] = [
  {
    value: "lyrics",
    label: "Keep lyrics",
    description: "Same lyrics, new music and artwork",
  },
  {
    value: "blueprint",
    label: "Keep blueprint",
    description: "Same song concept, new lyrics and music",
  },
  {
    value: "none",
    label: "Fresh start",
    description: "New blueprint, lyrics, music, and artwork",
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
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
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
        className="w-full max-w-md rounded-2xl p-6 space-y-5 outline-none"
        style={{
          backgroundColor: "var(--color-surface-1)",
          border: "1px solid var(--color-surface-3)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2
            id="regenerate-title"
            className="text-lg font-bold text-white"
          >
            Regenerate Song
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-surface-3 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Radio options */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-gray-400 mb-1">
            What would you like to keep?
          </legend>

          {KEEP_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors"
              style={{
                backgroundColor:
                  keep === option.value
                    ? "rgba(240,165,0,0.08)"
                    : "var(--color-surface-2)",
                border: `1px solid ${
                  keep === option.value
                    ? "rgba(240,165,0,0.3)"
                    : "transparent"
                }`,
              }}
            >
              <input
                type="radio"
                name="keep"
                value={option.value}
                checked={keep === option.value}
                onChange={() => setKeep(option.value)}
                className="mt-0.5 shrink-0"
                style={{ accentColor: "var(--color-amber)" }}
              />
              <div>
                <p className="text-sm font-medium text-white">{option.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{option.description}</p>
              </div>
            </label>
          ))}
        </fieldset>

        {/* Credit notice */}
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{
            backgroundColor: "rgba(240,165,0,0.08)",
            color: "var(--color-amber)",
          }}
        >
          <svg
            className="w-4 h-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
          This will use 1 credit
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 px-1">{error}</p>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              backgroundColor: "var(--color-surface-2)",
              color: "#9ca3af",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            style={{
              backgroundColor: "var(--color-amber)",
              color: "var(--color-charcoal)",
            }}
          >
            {isSubmitting ? "Regenerating…" : "Regenerate"}
          </button>
        </div>
      </div>
    </div>
  );
}
