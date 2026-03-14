import { useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../hooks/useAuth.js";
import { useApi } from "../hooks/useApi.js";
import { useSongs } from "../hooks/useSongs.js";
import { GenreSelector } from "../components/studio/GenreSelector.js";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDurationLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "yo", label: "Yoruba" },
  { value: "tw", label: "Twi" },
  { value: "pcm", label: "Pidgin" },
  { value: "pt", label: "Portuguese" },
  { value: "ar", label: "Arabic" },
] as const;

// ─── Animated gradient border textarea ────────────────────────────────────────

const PROMPT_PLACEHOLDER =
  'e.g., "An upbeat Afrobeats love song about dancing in Lagos at night, joyful and romantic"';

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Studio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const songs = useSongs();
  const { call, loading, error } = useApi<{ song_id: string }>();

  const [prompt, setPrompt] = useState(() => searchParams.get("prompt") ?? "");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [genre, setGenre] = useState<string | undefined>(undefined);
  const [mood, setMood] = useState("");
  const [language, setLanguage] = useState<string | undefined>(undefined);
  const [duration, setDuration] = useState(180);
  const [promptFocused, setPromptFocused] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim()) return;

      const result = await call(() =>
        songs.generate({
          prompt: prompt.trim(),
          genre: genre || undefined,
          mood: mood.trim() || undefined,
          language: language || undefined,
          duration: duration !== 180 ? duration : undefined,
        })
      );

      if (result) {
        void navigate(`/studio/song/${result.song_id}`);
      }
    },
    [call, songs, prompt, genre, mood, language, duration, navigate]
  );

  const durationPercent = ((duration - 30) / (600 - 30)) * 100;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Keyframes injected once */}
      <style>{`
        @keyframes rotate-gradient {
          0%   { --angle: 0deg; }
          100% { --angle: 360deg; }
        }
        @keyframes border-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes generate-pulse {
          0%, 100% { box-shadow: 0 6px 28px rgba(240,165,0,0.45), 0 1px 0 rgba(255,255,255,0.2) inset; }
          50%       { box-shadow: 0 8px 48px rgba(240,165,0,0.65), 0 1px 0 rgba(255,255,255,0.25) inset; }
        }
        @keyframes shimmer-slide {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .generate-btn-idle {
          animation: generate-pulse 2.5s ease-in-out infinite;
        }
      `}</style>

      {/* Page header */}
      <div className="space-y-1">
        <h1
          className="text-4xl font-bold"
          style={{
            fontFamily: "var(--font-display)",
            background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.75) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Create a Song
        </h1>
        <p className="text-gray-400" style={{ fontFamily: "var(--font-body)" }}>
          Describe the song you want and let AI bring it to life.
        </p>
      </div>

      {/* Form card */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, var(--color-surface-2) 0%, var(--color-surface-1) 100%)",
          border: "1px solid rgba(240,165,0,0.15)",
          boxShadow: "0 8px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03) inset",
        }}
      >
        {/* Top accent line */}
        <div
          style={{
            height: "2px",
            background: "linear-gradient(90deg, transparent 0%, rgba(240,165,0,0.6) 30%, rgba(255,209,102,0.8) 50%, rgba(240,165,0,0.6) 70%, transparent 100%)",
          }}
        />

        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-6">
          {/* Prompt textarea — atmospheric golden microphone feel */}
          <div className="space-y-2">
            <label
              htmlFor="prompt"
              className="flex items-center gap-2 text-sm font-semibold"
              style={{ color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-display)" }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--color-amber)" }}>
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
              </svg>
              Describe your song
            </label>

            {/* Animated border wrapper */}
            <div
              className="relative rounded-xl p-px overflow-hidden"
              style={{
                background: promptFocused
                  ? "linear-gradient(135deg, rgba(240,165,0,0.6) 0%, rgba(255,209,102,0.4) 25%, rgba(194,65,12,0.5) 50%, rgba(240,165,0,0.6) 75%, rgba(255,209,102,0.4) 100%)"
                  : "rgba(255,255,255,0.08)",
                transition: "background 0.3s ease",
              }}
            >
              <div className="relative rounded-[11px] overflow-hidden">
                <textarea
                  id="prompt"
                  rows={5}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onFocus={() => setPromptFocused(true)}
                  onBlur={() => setPromptFocused(false)}
                  placeholder={PROMPT_PLACEHOLDER}
                  maxLength={1000}
                  className="w-full px-5 py-4 text-white placeholder-gray-600 resize-none focus:outline-none"
                  style={{
                    background: "var(--color-surface-2)",
                    fontSize: "1rem",
                    lineHeight: "1.7",
                    fontFamily: "var(--font-body)",
                    boxShadow: promptFocused
                      ? "0 0 0 0 transparent, inset 0 0 30px rgba(240,165,0,0.04)"
                      : "none",
                    transition: "box-shadow 0.3s ease",
                  }}
                />
                {/* Inner glow on focus */}
                {promptFocused && (
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: "radial-gradient(ellipse at 50% 100%, rgba(240,165,0,0.05) 0%, transparent 60%)",
                    }}
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>

            {/* Character count */}
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "rgba(107,114,128,0.7)" }}>
                {prompt.length === 0 && "Tip: be specific about mood, instruments, tempo, and story"}
              </span>
              <span
                className="text-xs tabular-nums"
                style={{
                  color: prompt.length > 900 ? "var(--color-amber)" : "rgba(107,114,128,0.6)",
                  fontFamily: "monospace",
                }}
              >
                {prompt.length}/1000
              </span>
            </div>
          </div>

          {/* Advanced options toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="group flex items-center gap-2.5 text-sm font-medium transition-colors duration-150"
              style={{
                color: showAdvanced ? "var(--color-amber-light)" : "rgba(156,163,175,0.8)",
                fontFamily: "var(--font-display)",
              }}
            >
              <div
                className="flex items-center justify-center w-6 h-6 rounded-lg transition-all duration-200"
                style={{
                  background: showAdvanced ? "rgba(240,165,0,0.15)" : "rgba(255,255,255,0.05)",
                  border: showAdvanced ? "1px solid rgba(240,165,0,0.3)" : "1px solid rgba(255,255,255,0.08)",
                  transform: showAdvanced ? "rotate(0deg)" : "rotate(0deg)",
                }}
              >
                {/* Mixing console knob icon */}
                <svg
                  className="w-3.5 h-3.5 transition-transform duration-200"
                  style={{
                    color: showAdvanced ? "var(--color-amber)" : "rgba(156,163,175,0.6)",
                    transform: showAdvanced ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <span>Customize</span>
              {!showAdvanced && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(107,114,128,0.7)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  Genre, Mood, Language, Duration
                </span>
              )}
            </button>

            {/* Collapsible mixing console */}
            <div
              className="overflow-hidden transition-all duration-300 ease-in-out"
              style={{ maxHeight: showAdvanced ? "700px" : "0px" }}
            >
              <div
                className="mt-4 rounded-xl p-4 space-y-5"
                style={{
                  background: "rgba(0,0,0,0.2)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                {/* Console header decoration */}
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" style={{ color: "rgba(240,165,0,0.5)" }}>
                    <path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z" />
                  </svg>
                  <span
                    className="text-xs uppercase tracking-widest"
                    style={{ color: "rgba(156,163,175,0.4)", fontFamily: "var(--font-display)" }}
                  >
                    Mix Console
                  </span>
                  <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
                </div>

                {/* Genre */}
                <div className="space-y-1.5">
                  <label
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "rgba(156,163,175,0.7)", fontFamily: "var(--font-display)" }}
                  >
                    <span style={{ color: "var(--color-amber)", fontSize: "0.7rem" }}>🌍</span>
                    Genre
                  </label>
                  <GenreSelector value={genre} onChange={setGenre} />
                </div>

                {/* Two-column: Mood + Language */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Mood */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="mood"
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "rgba(156,163,175,0.7)", fontFamily: "var(--font-display)" }}
                    >
                      <span style={{ fontSize: "0.7rem" }}>😊</span>
                      Mood
                    </label>
                    <input
                      id="mood"
                      type="text"
                      value={mood}
                      onChange={(e) => setMood(e.target.value)}
                      placeholder="romantic, energetic…"
                      className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none transition-all duration-200"
                      style={{
                        background: "rgba(18,18,42,0.7)",
                        border: "1px solid rgba(45,45,88,0.8)",
                        fontFamily: "var(--font-body)",
                      }}
                      onFocus={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "rgba(240,165,0,0.5)";
                        (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(240,165,0,0.08)";
                      }}
                      onBlur={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "rgba(45,45,88,0.8)";
                        (e.currentTarget as HTMLElement).style.boxShadow = "none";
                      }}
                    />
                  </div>

                  {/* Language */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="language"
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "rgba(156,163,175,0.7)", fontFamily: "var(--font-display)" }}
                    >
                      <span style={{ fontSize: "0.7rem" }}>🗣️</span>
                      Language
                    </label>
                    <select
                      id="language"
                      value={language ?? ""}
                      onChange={(e) => setLanguage(e.target.value || undefined)}
                      className="w-full rounded-xl px-4 py-3 text-white focus:outline-none appearance-none cursor-pointer transition-all duration-200"
                      style={{
                        background: "rgba(18,18,42,0.7)",
                        border: "1px solid rgba(45,45,88,0.8)",
                        fontFamily: "var(--font-body)",
                        color: language ? "white" : "rgba(107,114,128,0.8)",
                      }}
                      onFocus={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "rgba(240,165,0,0.5)";
                        (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(240,165,0,0.08)";
                      }}
                      onBlur={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "rgba(45,45,88,0.8)";
                        (e.currentTarget as HTMLElement).style.boxShadow = "none";
                      }}
                    >
                      <option value="">Any language</option>
                      {LANGUAGES.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Duration slider — visual time bar */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="duration"
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "rgba(156,163,175,0.7)", fontFamily: "var(--font-display)" }}
                    >
                      <span style={{ fontSize: "0.7rem" }}>⏱️</span>
                      Duration
                    </label>
                    <span
                      className="text-sm font-bold tabular-nums px-2.5 py-1 rounded-lg"
                      style={{
                        background: "rgba(240,165,0,0.12)",
                        border: "1px solid rgba(240,165,0,0.2)",
                        color: "var(--color-amber)",
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      {formatDurationLabel(duration)}
                    </span>
                  </div>

                  {/* Visual time bar */}
                  <div className="relative">
                    {/* Track background */}
                    <div
                      className="w-full rounded-full overflow-hidden"
                      style={{ height: "6px", background: "rgba(255,255,255,0.06)" }}
                    >
                      {/* Filled portion */}
                      <div
                        className="h-full rounded-full transition-all duration-100"
                        style={{
                          width: `${durationPercent}%`,
                          background: "linear-gradient(90deg, var(--color-amber) 0%, var(--color-amber-light) 100%)",
                          boxShadow: "0 0 8px rgba(240,165,0,0.4)",
                        }}
                      />
                    </div>

                    {/* Actual range input on top */}
                    <input
                      id="duration"
                      type="range"
                      min={30}
                      max={600}
                      step={15}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer"
                      style={{ height: "6px", zIndex: 1 }}
                    />
                  </div>

                  {/* Tick marks with time labels */}
                  <div className="flex justify-between text-xs" style={{ color: "rgba(107,114,128,0.5)" }}>
                    <span>0:30</span>
                    <span>2:30</span>
                    <span>5:00</span>
                    <span>7:30</span>
                    <span>10:00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm flex items-start gap-2.5"
              style={{
                background: "rgba(231,76,60,0.08)",
                border: "1px solid rgba(231,76,60,0.2)",
                color: "var(--color-coral)",
              }}
            >
              <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
                <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
              </svg>
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 pt-1">
            {/* Generate button — THE most important CTA */}
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="flex-1 flex items-center justify-center gap-2.5 py-4 px-8 rounded-xl font-bold text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:animation-none"
              style={{
                background: loading
                  ? "rgba(240,165,0,0.5)"
                  : "linear-gradient(135deg, var(--color-amber) 0%, #FFD166 40%, var(--color-amber) 70%, #D4920A 100%)",
                backgroundSize: "200% 200%",
                color: "var(--color-charcoal)",
                fontFamily: "var(--font-display)",
                letterSpacing: "0.02em",
                boxShadow: loading || !prompt.trim()
                  ? "none"
                  : "0 6px 28px rgba(240,165,0,0.45), 0 1px 0 rgba(255,255,255,0.2) inset",
                transform: "translateY(0)",
                animation: !loading && prompt.trim() ? "generate-pulse 2.5s ease-in-out infinite" : "none",
              }}
              onMouseEnter={(e) => {
                if (!loading && prompt.trim()) {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-2px) scale(1.01)";
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 10px 40px rgba(240,165,0,0.6), 0 1px 0 rgba(255,255,255,0.25) inset";
                  (e.currentTarget as HTMLElement).style.animation = "none";
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0) scale(1)";
                if (!loading && prompt.trim()) {
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 6px 28px rgba(240,165,0,0.45), 0 1px 0 rgba(255,255,255,0.2) inset";
                  (e.currentTarget as HTMLElement).style.animation = "generate-pulse 2.5s ease-in-out infinite";
                }
              }}
              onMouseDown={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0) scale(0.98)";
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-2px) scale(1.01)";
              }}
            >
              {loading ? (
                <>
                  <svg
                    className="w-5 h-5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Starting generation…
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                  Generate Song
                </>
              )}
            </button>

            {/* Credits badge */}
            <div
              className="shrink-0 flex items-center gap-2 px-3.5 py-3 rounded-xl text-sm font-semibold"
              style={{
                background: "rgba(240,165,0,0.08)",
                border: "1px solid rgba(240,165,0,0.2)",
                color: "var(--color-amber)",
                fontFamily: "var(--font-display)",
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93V18h-2v1.93c-3.94-.49-7-3.85-7-7.93h2v-2H4c0-4.07 3.06-7.44 7-7.93V4h2V2.07C16.94 2.56 20 5.92 20 10h-2v2h2c0 4.08-3.06 7.44-7 7.93z" />
              </svg>
              <span>{user?.credits_remaining ?? 0}</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
