import { useRef, useState, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────────

type ReferenceUploadProps = {
  file: File | null;
  onFileSelect: (file: File | null) => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/wave"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Only MP3 and WAV files are supported.";
  }
  if (file.size > MAX_BYTES) {
    return "File must be under 10 MB.";
  }
  return null;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function ReferenceUpload({ file, onFileSelect }: ReferenceUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSelect = useCallback(
    (selected: File) => {
      const err = validateFile(selected);
      if (err) {
        setValidationError(err);
        return;
      }
      setValidationError(null);
      onFileSelect(selected);
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) handleSelect(dropped);
    },
    [handleSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = e.target.files?.[0];
      if (picked) handleSelect(picked);
      // Reset input so same file can be re-selected after remove
      e.target.value = "";
    },
    [handleSelect]
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setValidationError(null);
      onFileSelect(null);
    },
    [onFileSelect]
  );

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  // ── Derived styles ──────────────────────────────────────────────────────────

  const zoneBorderColor = isDragOver
    ? "rgba(240,165,0,0.6)"
    : file
      ? "rgba(240,165,0,0.3)"
      : validationError
        ? "rgba(231,76,60,0.4)"
        : "rgba(36,36,72,0.9)";

  const zoneBackground = isDragOver
    ? "rgba(240,165,0,0.06)"
    : file
      ? "rgba(240,165,0,0.04)"
      : "var(--color-surface-1)";

  return (
    <div className="space-y-2">
      {/* Section label */}
      <div className="flex items-center gap-2">
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{ color: "var(--color-amber)" }}
          aria-hidden="true"
        >
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
        <span
          className="text-sm font-semibold"
          style={{ color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-display)" }}
        >
          Reference Track
          <span
            className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded-full"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "rgba(156,163,175,0.7)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            Optional
          </span>
        </span>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="audio/mpeg,audio/wav,.mp3,.wav"
        className="sr-only"
        onChange={handleInputChange}
        aria-label="Upload reference track"
        tabIndex={-1}
      />

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label={file ? `Reference track: ${file.name}. Click to replace.` : "Upload a reference track"}
        onClick={openFilePicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openFilePicker();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative flex items-center gap-4 px-5 py-4 rounded-2xl cursor-pointer transition-all duration-200 select-none focus:outline-none"
        style={{
          background: zoneBackground,
          border: `2px dashed ${zoneBorderColor}`,
          boxShadow: isDragOver ? "0 0 0 4px rgba(240,165,0,0.08)" : "none",
        }}
      >
        {file ? (
          // ── File selected state ──
          <>
            {/* Music file icon */}
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
              style={{
                background: "rgba(240,165,0,0.12)",
                border: "1px solid rgba(240,165,0,0.25)",
              }}
              aria-hidden="true"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--color-amber)" }}>
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>

            {/* File info */}
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium text-white truncate"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {file.name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(156,163,175,0.7)" }}>
                {formatFileSize(file.size)}
              </p>
            </div>

            {/* Remove button */}
            <button
              type="button"
              onClick={handleRemove}
              aria-label="Remove reference track"
              className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-all duration-150 focus:outline-none focus-visible:ring-2"
              style={{
                background: "rgba(231,76,60,0.1)",
                border: "1px solid rgba(231,76,60,0.2)",
                color: "var(--color-coral)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(231,76,60,0.2)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(231,76,60,0.1)";
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </>
        ) : (
          // ── Empty state ──
          <>
            {/* Waveform / music icon */}
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all duration-200"
              style={{
                background: isDragOver ? "rgba(240,165,0,0.15)" : "rgba(255,255,255,0.05)",
                border: isDragOver ? "1px solid rgba(240,165,0,0.35)" : "1px solid rgba(255,255,255,0.08)",
              }}
              aria-hidden="true"
            >
              {isDragOver ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-amber)" }}>
                  <polyline points="8 17 12 21 16 17" />
                  <line x1="12" y1="12" x2="12" y2="21" />
                  <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" style={{ color: "rgba(156,163,175,0.5)" }}>
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              )}
            </div>

            {/* Instructions */}
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium transition-colors duration-200"
                style={{
                  color: isDragOver ? "var(--color-amber-light)" : "rgba(255,255,255,0.7)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {isDragOver ? "Drop to upload" : "Drop a reference track or click to browse"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(107,114,128,0.7)" }}>
                MP3 or WAV · max 10 MB · AI will draw style inspiration from it
              </p>
            </div>

            {/* Browse hint badge */}
            {!isDragOver && (
              <span
                className="text-xs px-2.5 py-1 rounded-lg shrink-0 hidden sm:block"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(156,163,175,0.6)",
                  fontFamily: "var(--font-display)",
                }}
              >
                Browse
              </span>
            )}
          </>
        )}
      </div>

      {/* Validation error */}
      {validationError && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          role="alert"
          style={{
            background: "rgba(231,76,60,0.08)",
            border: "1px solid rgba(231,76,60,0.2)",
            color: "var(--color-coral)",
          }}
        >
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
            <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
          </svg>
          {validationError}
        </div>
      )}
    </div>
  );
}
