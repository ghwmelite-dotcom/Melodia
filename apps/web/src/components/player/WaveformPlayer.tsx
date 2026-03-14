import { useState, useEffect, useRef, useCallback } from "react";
import { useSongs } from "../../hooks/useSongs.js";
import { Waveform } from "./Waveform.js";

// ─── Types ─────────────────────────────────────────────────────────────────────

type WaveformPlayerProps = {
  songId: string;
  waveformData: number[] | null; // From song detail, null = loading/missing
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function WaveformPlayer({ songId, waveformData }: WaveformPlayerProps) {
  const songs = useSongs();

  const audioRef = useRef<HTMLAudioElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch audio blob on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchAudio() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const blob = await songs.getAudioBlob(songId);
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
      // Revoke object URL to free memory
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId]);

  // Audio event handlers
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

  // Play / Pause
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
        // Play can be rejected if audio isn't ready yet
        setIsPlaying(false);
      }
    }
  }, [isPlaying]);

  // Skip back / forward 10s
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

  // Waveform seek
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
  const waveformBars = waveformData ?? [];

  return (
    <div className="space-y-3">
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

      {/* Waveform + time */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="h-16 bg-surface-3 rounded-lg animate-pulse flex items-center justify-center">
              <span className="text-gray-400 text-xs">Loading audio…</span>
            </div>
          ) : loadError ? (
            <div className="h-16 bg-surface-3 rounded-lg flex items-center justify-center">
              <span className="text-coral text-xs">{loadError}</span>
            </div>
          ) : (
            <Waveform data={waveformBars} progress={progress} onSeek={handleSeek} />
          )}
        </div>

        {/* Time display */}
        <div className="shrink-0 text-sm tabular-nums text-gray-400 whitespace-nowrap">
          <span className="text-white">{formatTime(currentTime)}</span>
          <span className="mx-1">/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {/* Skip back */}
        <button
          onClick={skipBack}
          disabled={isLoading || !!loadError}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-surface-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          aria-label="Skip back 10 seconds"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
          </svg>
          <span>10s</span>
        </button>

        {/* Play / Pause */}
        <button
          onClick={() => void togglePlay()}
          disabled={isLoading || !!loadError}
          className="w-12 h-12 rounded-full bg-amber text-charcoal flex items-center justify-center hover:bg-amber/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
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
          disabled={isLoading || !!loadError}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-surface-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          aria-label="Skip forward 10 seconds"
        >
          <span>10s</span>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
