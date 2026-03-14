import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router";
import { useAuth } from "../hooks/useAuth.js";
import { useApi } from "../hooks/useApi.js";
import { useSongs } from "../hooks/useSongs.js";
import { SongCard } from "../components/song/SongCard.js";
import type { Song } from "@melodia/shared";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const songs = useSongs();
  const { call, loading: generating } = useApi<{ song_id: string }>();

  const [quickPrompt, setQuickPrompt] = useState("");
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [recentSongs, setRecentSongs] = useState<Song[]>([]);

  // Load recent songs on mount
  useEffect(() => {
    songs
      .listSongs({ limit: 5 })
      .then((res) => setRecentSongs(res.songs))
      .catch(() => {
        // Non-critical — silently fail
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quick generate handler
  const handleQuickGenerate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!quickPrompt.trim()) return;
      setGenerateError(null);

      const result = await call(() =>
        songs.generate({ prompt: quickPrompt.trim() })
      );

      if (result) {
        void navigate(`/studio/song/${result.song_id}`);
      } else {
        setGenerateError("Failed to start generation. Check your credits and try again.");
      }
    },
    [call, songs, quickPrompt, navigate]
  );

  const planColors: Record<string, { bg: string; text: string; border: string }> = {
    free: {
      bg: "rgba(45, 45, 80, 0.5)",
      text: "#9ca3af",
      border: "var(--color-surface-3)",
    },
    pro: {
      bg: "rgba(240, 165, 0, 0.12)",
      text: "var(--color-amber)",
      border: "rgba(240, 165, 0, 0.3)",
    },
    enterprise: {
      bg: "rgba(0, 210, 255, 0.1)",
      text: "var(--color-teal)",
      border: "rgba(0, 210, 255, 0.3)",
    },
  };

  const planStyle = planColors[user?.plan ?? "free"] ?? planColors["free"];

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Welcome back,{" "}
          <span style={{ color: "var(--color-amber)" }}>
            {user?.display_name ?? user?.username ?? "Musician"}
          </span>
        </h1>
        <p className="mt-1 text-gray-400">
          Your AI music studio — let&apos;s create something.
        </p>
      </div>

      {/* Quick generate */}
      <div
        className="rounded-2xl border p-5"
        style={{
          backgroundColor: "var(--color-surface-1)",
          borderColor: "var(--color-surface-3)",
        }}
      >
        <form
          onSubmit={(e) => void handleQuickGenerate(e)}
          className="flex gap-3"
        >
          <input
            type="text"
            value={quickPrompt}
            onChange={(e) => setQuickPrompt(e.target.value)}
            placeholder="What do you want to create?"
            className="flex-1 min-w-0 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2"
            style={{
              backgroundColor: "var(--color-surface-2)",
              // @ts-expect-error CSS custom prop
              "--tw-ring-color": "var(--color-amber)",
            }}
          />
          <button
            type="submit"
            disabled={generating || !quickPrompt.trim()}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            style={{ backgroundColor: "var(--color-amber)", color: "var(--color-charcoal)" }}
          >
            {generating ? (
              <svg
                className="w-4 h-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            )}
            Generate
          </button>
        </form>
        {generateError && (
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--color-coral)" }}
          >
            {generateError}
          </p>
        )}
      </div>

      {/* Recent songs */}
      {recentSongs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Songs</h2>
            <Link
              to="/library"
              className="text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: "var(--color-amber)" }}
            >
              View All →
            </Link>
          </div>
          <div className="overflow-x-auto -mx-1 px-1">
            <div className="flex gap-4 snap-x snap-mandatory pb-2" style={{ width: "max-content" }}>
              {recentSongs.map((song) => (
                <div
                  key={song.id}
                  className="snap-start shrink-0"
                  style={{ width: "160px" }}
                >
                  <SongCard song={song} compact />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {recentSongs.length === 0 && (
        <div
          className="rounded-2xl border p-6 flex items-center justify-between"
          style={{
            backgroundColor: "var(--color-surface-1)",
            borderColor: "var(--color-surface-3)",
          }}
        >
          <div>
            <p className="text-white font-medium">No songs yet</p>
            <p className="text-gray-400 text-sm mt-0.5">
              Create your first AI-generated song.
            </p>
          </div>
          <Link
            to="/studio"
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={{ backgroundColor: "var(--color-amber)", color: "var(--color-charcoal)" }}
          >
            Create a Song
          </Link>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Credits card */}
        <div
          className="rounded-2xl p-5 border"
          style={{
            backgroundColor: "var(--color-surface-1)",
            borderColor: "var(--color-surface-3)",
          }}
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Credits Remaining
          </p>
          <p
            className="text-4xl font-bold"
            style={{ color: "var(--color-amber)" }}
          >
            {user?.credits_remaining ?? 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">AI generation credits</p>
        </div>

        {/* Plan card */}
        <div
          className="rounded-2xl p-5 border"
          style={{
            backgroundColor: "var(--color-surface-1)",
            borderColor: "var(--color-surface-3)",
          }}
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Current Plan
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold capitalize"
              style={{
                backgroundColor: planStyle.bg,
                color: planStyle.text,
                border: `1px solid ${planStyle.border}`,
              }}
            >
              {user?.plan ?? "free"}
            </span>
          </div>
        </div>

        {/* Member since */}
        <div
          className="rounded-2xl p-5 border"
          style={{
            backgroundColor: "var(--color-surface-1)",
            borderColor: "var(--color-surface-3)",
          }}
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Member Since
          </p>
          <p className="text-lg font-semibold text-white">
            {user?.created_at
              ? new Date(user.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
