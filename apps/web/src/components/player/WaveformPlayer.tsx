import { useState, useEffect, useRef, useCallback } from "react";
import { useSongs } from "../../hooks/useSongs.js";
import { Waveform } from "./Waveform.js";

// ─── Types ─────────────────────────────────────────────────────────────────────

type WaveformPlayerProps = {
  songId: string;
  waveformData: number[] | null;
  /** Which variation to stream (0-based). Defaults to 0 (primary). */
  variationIndex?: number;
  /** Optional artwork URL for thumbnail display */
  artworkUrl?: string;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function WaveformPlayer({
  songId,
  waveformData,
  variationIndex = 0,
  artworkUrl,
}: WaveformPlayerProps) {
  const songs = useSongs();

  const audioRef = useRef<HTMLAudioElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch audio blob whenever songId or variationIndex changes
  useEffect(() => {
    let cancelled = false;

    async function fetchAudio() {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
      }
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setIsLoading(true);
      setLoadError(null);

      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setAudioBlobUrl(null);

      try {
        const blob = await songs.getAudioBlob(songId, variationIndex);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setAudioBlobUrl(url);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load audio";
        setLoadError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchAudio();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId, variationIndex]);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (audio) setDuration(audio.duration);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (audio) setCurrentTime(audio.currentTime);
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  }, [isPlaying]);

  const skipBack = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  }, []);

  const skipForward = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
  }, []);

  const handleSeek = useCallback(
    (position: number) => {
      const audio = audioRef.current;
      if (!audio || !isFinite(duration) || duration === 0) return;
      audio.currentTime = position * duration;
      setCurrentTime(audio.currentTime);
    },
    [duration]
  );

  const progress = duration > 0 ? currentTime / duration : 0;
  const waveformBars = variationIndex === 0 ? (waveformData ?? []) : [];
  const disabled = isLoading || !!loadError;

  return (
    <div className="space-y-4">
      {/* Hidden audio element */}
      {audioBlobUrl && (
        <audio
          ref={audioRef}
          src={audioBlobUrl}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          preload="metadata"
        />
      )}

      {/* Waveform display */}
      <div className="relative">
        {isLoading ? (
          <div
            className="rounded-xl flex items-center justify-center gap-2"
            style={{
              height: "78px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            {/* Animated waveform bars placeholder */}
            <div className="flex items-end gap-0.5 h-8">
              {Array.from({ length: 18 }, (_, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full"
                  style={{
                    height: `${Math.sin(i * 0.6) * 60 + 40}%`,
                    background: "rgba(240,165,0,0.25)",
                    animation: `waveBar 1.2s ease-in-out ${i * 0.07}s infinite`,
                    transformOrigin: "bottom",
                  }}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500 ml-2">Loading audio…</span>
          </div>
        ) : loadError ? (
          <div
            className="rounded-xl flex items-center justify-center gap-2"
            style={{
              height: "78px",
              background: "rgba(231,76,60,0.05)",
              border: "1px solid rgba(231,76,60,0.15)",
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: "var(--color-coral)" }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
              <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
            </svg>
            <span className="text-sm" style={{ color: "var(--color-coral)" }}>{loadError}</span>
          </div>
        ) : (
          <Waveform data={waveformBars} progress={progress} onSeek={handleSeek} />
        )}
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-3">
        {/* Artwork thumbnail */}
        {artworkUrl && (
          <div
            className="shrink-0 w-12 h-12 rounded-xl overflow-hidden"
            style={{
              boxShadow: "0 4px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(240,165,0,0.15)",
            }}
          >
            <img
              src={artworkUrl}
              alt=""
              className="w-full h-full object-cover"
              aria-hidden="true"
            />
          </div>
        )}

        {/* Skip back */}
        <button
          onClick={skipBack}
          disabled={disabled}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            color: "#9ca3af",
            backgroundColor: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            fontFamily: "var(--font-display)",
          }}
          aria-label="Skip back 10 seconds"
          onMouseEnter={(e) => {
            if (!disabled) {
              (e.currentTarget as HTMLElement).style.color = "#fff";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#9ca3af";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
          }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
          </svg>
          <span className="text-xs">10s</span>
        </button>

        {/* Play / Pause — large, prominent */}
        <button
          onClick={() => void togglePlay()}
          disabled={disabled}
          className="relative flex items-center justify-center rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            width: "56px",
            height: "56px",
            background: disabled
              ? "rgba(240,165,0,0.4)"
              : isPlaying
                ? "linear-gradient(135deg, #D4920A 0%, var(--color-amber) 100%)"
                : "linear-gradient(135deg, var(--color-amber) 0%, #FFD166 50%, var(--color-amber) 100%)",
            backgroundSize: "200% 200%",
            boxShadow: disabled
              ? "none"
              : isPlaying
                ? "0 4px 20px rgba(240,165,0,0.4)"
                : "0 6px 28px rgba(240,165,0,0.45), 0 1px 0 rgba(255,255,255,0.2) inset",
            transform: isPlaying ? "scale(0.95)" : "scale(1)",
            color: "var(--color-charcoal)",
          }}
          aria-label={isPlaying ? "Pause" : "Play"}
          onMouseEnter={(e) => {
            if (!disabled) {
              (e.currentTarget as HTMLElement).style.boxShadow =
                "0 8px 36px rgba(240,165,0,0.6), 0 1px 0 rgba(255,255,255,0.25) inset";
              (e.currentTarget as HTMLElement).style.transform = isPlaying ? "scale(0.93)" : "scale(1.05)";
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = disabled
              ? "none"
              : isPlaying
                ? "0 4px 20px rgba(240,165,0,0.4)"
                : "0 6px 28px rgba(240,165,0,0.45), 0 1px 0 rgba(255,255,255,0.2) inset";
            (e.currentTarget as HTMLElement).style.transform = isPlaying ? "scale(0.95)" : "scale(1)";
          }}
        >
          {/* Pulse ring when playing */}
          {isPlaying && !disabled && (
            <span
              className="absolute inset-0 rounded-full"
              style={{
                border: "2px solid rgba(240,165,0,0.4)",
                animation: "pulse-ring 1.8s ease-out infinite",
              }}
              aria-hidden="true"
            />
          )}

          {isLoading ? (
            <svg
              className="w-5 h-5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : isPlaying ? (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Skip forward */}
        <button
          onClick={skipForward}
          disabled={disabled}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            color: "#9ca3af",
            backgroundColor: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            fontFamily: "var(--font-display)",
          }}
          aria-label="Skip forward 10 seconds"
          onMouseEnter={(e) => {
            if (!disabled) {
              (e.currentTarget as HTMLElement).style.color = "#fff";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#9ca3af";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
          }}
        >
          <span className="text-xs">10s</span>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
          </svg>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Time display — monospace */}
        <div
          className="shrink-0 text-sm tabular-nums whitespace-nowrap"
          style={{ fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace" }}
        >
          <span className="font-semibold" style={{ color: "var(--color-amber-light)" }}>
            {formatTime(currentTime)}
          </span>
          <span className="mx-1.5" style={{ color: "rgba(107,114,128,0.6)" }}>/</span>
          <span style={{ color: "rgba(156,163,175,0.7)" }}>{formatTime(duration)}</span>
        </div>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.7; }
          70%  { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
