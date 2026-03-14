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

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Studio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const songs = useSongs();
  const { call, loading, error } = useApi<{ song_id: string }>();

  // Pre-fill from ?prompt= URL param (used by "Try Again" from failed songs)
  const [prompt, setPrompt] = useState(() => searchParams.get("prompt") ?? "");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [genre, setGenre] = useState<string | undefined>(undefined);
  const [mood, setMood] = useState("");
  const [language, setLanguage] = useState<string | undefined>(undefined);
  const [duration, setDuration] = useState(180);

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

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Create a Song</h1>
        <p className="mt-1 text-gray-400">
          Describe the song you want and let AI bring it to life.
        </p>
      </div>

      {/* Form card */}
      <div
        className="rounded-2xl border p-6 space-y-5"
        style={{
          backgroundColor: "var(--color-surface-1)",
          borderColor: "var(--color-surface-3)",
        }}
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          {/* Prompt textarea */}
          <div>
            <label
              htmlFor="prompt"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Describe your song
            </label>
            <textarea
              id="prompt"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='e.g., "An upbeat Afrobeats love song about dancing in Lagos at night, joyful and romantic"'
              maxLength={1000}
              className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 resize-none"
              style={{
                backgroundColor: "var(--color-surface-2)",
                // @ts-expect-error CSS custom prop
                "--tw-ring-color": "var(--color-amber)",
              }}
            />
            <p className="text-right text-xs text-gray-600 mt-1">
              {prompt.length}/1000
            </p>
          </div>

          {/* Customize toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 9l-7 7-7-7" />
              </svg>
              Customize
            </button>

            {/* Collapsible advanced section */}
            <div
              className="overflow-hidden transition-all duration-300 ease-in-out"
              style={{ maxHeight: showAdvanced ? "600px" : "0px" }}
            >
              <div className="pt-4 space-y-4">
                {/* Genre */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Genre
                  </label>
                  <GenreSelector value={genre} onChange={setGenre} />
                </div>

                {/* Mood */}
                <div>
                  <label
                    htmlFor="mood"
                    className="block text-sm font-medium text-gray-300 mb-1.5"
                  >
                    Mood
                  </label>
                  <input
                    id="mood"
                    type="text"
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                    placeholder="romantic, energetic, melancholy..."
                    className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: "var(--color-surface-2)",
                      // @ts-expect-error CSS custom prop
                      "--tw-ring-color": "var(--color-amber)",
                    }}
                  />
                </div>

                {/* Language */}
                <div>
                  <label
                    htmlFor="language"
                    className="block text-sm font-medium text-gray-300 mb-1.5"
                  >
                    Language
                  </label>
                  <select
                    id="language"
                    value={language ?? ""}
                    onChange={(e) =>
                      setLanguage(e.target.value || undefined)
                    }
                    className="w-full rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 border appearance-none cursor-pointer"
                    style={{
                      backgroundColor: "var(--color-surface-2)",
                      borderColor: "var(--color-surface-3)",
                      // @ts-expect-error CSS custom prop
                      "--tw-ring-color": "var(--color-amber)",
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

                {/* Duration slider */}
                <div>
                  <label
                    htmlFor="duration"
                    className="block text-sm font-medium text-gray-300 mb-1.5"
                  >
                    Duration{" "}
                    <span style={{ color: "var(--color-amber)" }}>
                      {formatDurationLabel(duration)}
                    </span>
                  </label>
                  <input
                    id="duration"
                    type="range"
                    min={30}
                    max={600}
                    step={15}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{
                      backgroundColor: "var(--color-surface-3)",
                      accentColor: "var(--color-amber)",
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>0:30</span>
                    <span>10:00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm border"
              style={{
                backgroundColor: "rgba(255, 107, 107, 0.1)",
                borderColor: "rgba(255, 107, 107, 0.3)",
                color: "var(--color-coral)",
              }}
            >
              {error}
            </div>
          )}

          {/* Footer: generate button + credits */}
          <div className="flex items-center gap-4 pt-1">
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-charcoal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--color-amber)" }}
            >
              {loading ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
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
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                  Generate Song
                </>
              )}
            </button>

            {/* Credits badge */}
            <div
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium"
              style={{
                backgroundColor: "var(--color-surface-2)",
                color: "var(--color-amber)",
              }}
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93V18h-2v1.93c-3.94-.49-7-3.85-7-7.93h2v-2H4c0-4.07 3.06-7.44 7-7.93V4h2V2.07C16.94 2.56 20 5.92 20 10h-2v2h2c0 4.08-3.06 7.44-7 7.93z" />
              </svg>
              {user?.credits_remaining ?? 0} credits
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
