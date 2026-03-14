import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useAuth } from "../hooks/useAuth.js";
import { useSongs } from "../hooks/useSongs.js";
import { GenerationProgress } from "../components/song/GenerationProgress.js";
import { WaveformPlayer } from "../components/player/WaveformPlayer.js";
import { LyricsDisplay } from "../components/song/LyricsDisplay.js";
import { SongMeta } from "../components/song/SongMeta.js";
import { LikeButton } from "../components/song/LikeButton.js";
import type { SongDetail } from "@melodia/shared";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isGenerating(status: SongDetail["status"]): boolean {
  return (
    status === "pending" ||
    status === "generating_lyrics" ||
    status === "generating_music" ||
    status === "generating_artwork" ||
    status === "processing"
  );
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Genre gradient colours (for artwork placeholder) ──────────────────────────

const GENRE_GRADIENTS: Record<string, [string, string]> = {
  afrobeats: ["rgba(240,165,0,0.3)", "rgba(194,65,12,0.3)"],
  "afro-fusion": ["rgba(240,165,0,0.3)", "rgba(202,138,4,0.3)"],
  "afro-soul": ["rgba(147,51,234,0.3)", "rgba(219,39,119,0.3)"],
  highlife: ["rgba(22,163,74,0.3)", "rgba(13,148,136,0.3)"],
  amapiano: ["rgba(13,148,136,0.3)", "rgba(37,99,235,0.3)"],
  "hip-hop": ["rgba(75,85,99,0.5)", "rgba(17,24,39,0.5)"],
  pop: ["rgba(219,39,119,0.3)", "rgba(147,51,234,0.3)"],
};

function artworkGradient(genre: string | null): string {
  const colors = genre ? (GENRE_GRADIENTS[genre] ?? null) : null;
  if (colors) {
    return `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
  }
  return "linear-gradient(135deg, var(--color-surface-3), var(--color-surface-2))";
}

// ─── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div
        className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: "var(--color-amber)", borderTopColor: "transparent" }}
      />
    </div>
  );
}

// ─── Visibility Badge ──────────────────────────────────────────────────────────

function VisibilityBadge({ isPublic }: { isPublic: boolean }) {
  if (isPublic) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ backgroundColor: "rgba(0,210,255,0.15)", color: "var(--color-teal)" }}
      >
        Public
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: "var(--color-surface-3)", color: "#9ca3af" }}
    >
      Private
    </span>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SongView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const songs = useSongs();

  const [song, setSong] = useState<SongDetail | null>(null);
  const [loadingState, setLoadingState] = useState<"loading" | "loaded" | "error">(
    "loading"
  );
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publishToggling, setPublishToggling] = useState(false);

  // Fetch song details
  const fetchSong = useCallback(async () => {
    if (!id) return;
    try {
      const data = await songs.getSong(id);
      setSong(data);
      setLoadingState("loaded");
    } catch {
      setLoadingState("error");
    }
  }, [id, songs]);

  useEffect(() => {
    void fetchSong();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Called when GenerationProgress signals completion
  const handleGenerationComplete = useCallback(async () => {
    await fetchSong();
    await refresh();
  }, [fetchSong, refresh]);

  // Delete song
  const handleDelete = useCallback(async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await songs.deleteSong(id);
      void navigate("/library");
    } catch {
      setDeleting(false);
      setDeleteConfirming(false);
    }
  }, [id, songs, navigate]);

  // Toggle publish state
  const handlePublishToggle = useCallback(async () => {
    if (!song || publishToggling) return;
    setPublishToggling(true);
    try {
      const updated = await songs.updateSong(song.id, { is_public: !song.is_public });
      setSong(updated);
    } catch {
      // Silently fail — keep current state
    } finally {
      setPublishToggling(false);
    }
  }, [song, songs, publishToggling]);

  // ── Loading ──

  if (loadingState === "loading") {
    return <Spinner />;
  }

  // ── Error / Not found ──

  if (loadingState === "error" || !song) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-xl font-semibold text-white">Song not found</p>
        <p className="text-gray-400 text-sm">
          This song doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Link
          to="/library"
          className="inline-block px-4 py-2 rounded-xl text-sm font-medium"
          style={{ backgroundColor: "var(--color-surface-2)", color: "var(--color-amber)" }}
        >
          Back to Library
        </Link>
      </div>
    );
  }

  // ── Failed mode ──

  if (song.status === "failed") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Link
            to="/library"
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-4"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Library
          </Link>
          <h1 className="text-2xl font-bold text-white">Generation Failed</h1>
        </div>

        <div
          className="rounded-2xl border p-6 space-y-4"
          style={{
            backgroundColor: "rgba(255,107,107,0.05)",
            borderColor: "rgba(255,107,107,0.2)",
          }}
        >
          {/* Original prompt */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Your prompt
            </p>
            <p className="text-gray-200 text-sm leading-relaxed">
              &ldquo;{song.user_prompt}&rdquo;
            </p>
          </div>

          {/* Credits refunded notice */}
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
            style={{
              backgroundColor: "rgba(13,148,136,0.1)",
              color: "var(--color-teal)",
            }}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Your credits have been refunded.
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() =>
              void navigate(
                `/studio?prompt=${encodeURIComponent(song.user_prompt)}`
              )
            }
            className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold transition-colors"
            style={{ backgroundColor: "var(--color-amber)", color: "var(--color-charcoal)" }}
          >
            Try Again
          </button>
          <Link
            to="/library"
            className="flex items-center justify-center px-6 py-3 rounded-xl text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--color-surface-2)",
              color: "var(--color-gray-400, #9ca3af)",
            }}
          >
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  // ── Generating mode ──

  if (isGenerating(song.status)) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Link
            to="/library"
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-4"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Library
          </Link>
          <h1 className="text-2xl font-bold text-white">
            {song.title || "Creating your song…"}
          </h1>
          {song.user_prompt && (
            <p className="mt-1 text-gray-400 text-sm italic">
              &ldquo;{song.user_prompt}&rdquo;
            </p>
          )}
        </div>

        <GenerationProgress
          songId={song.id}
          onComplete={() => void handleGenerationComplete()}
        />
      </div>
    );
  }

  // ── Completed mode ──

  const isOwner = user?.id === song.user_id;
  const isLikedByMe = (song as SongDetail & { is_liked?: boolean }).is_liked ?? false;

  // Parse waveform data from waveform_url: for MVP we pass null and let the
  // player show the flat fallback — the actual waveform JSON fetch would
  // require a new API endpoint.
  const waveformData: number[] | null = null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        to="/library"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Library
      </Link>

      {/* Top section: artwork + title info + actions */}
      <div className="flex flex-col sm:flex-row gap-5">
        {/* Artwork */}
        <div className="shrink-0">
          {song.artwork_url ? (
            <img
              src={song.artwork_url}
              alt={`${song.title} artwork`}
              className="w-full sm:w-48 sm:h-48 rounded-2xl object-cover shadow-lg"
              style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
            />
          ) : (
            <div
              className="w-full sm:w-48 sm:h-48 rounded-2xl flex items-center justify-center"
              style={{ background: artworkGradient(song.genre) }}
            >
              <svg
                className="w-16 h-16 text-gray-500 opacity-50"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          )}
        </div>

        {/* Song info */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title + visibility badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-bold text-white truncate">{song.title}</h1>
            {isOwner && <VisibilityBadge isPublic={song.is_public} />}
          </div>

          {/* Genre / sub-genre */}
          <p className="text-gray-400 capitalize">
            {[song.genre, song.sub_genre].filter(Boolean).join(" · ")}
          </p>

          {/* Key / BPM / duration */}
          <div className="flex flex-wrap gap-2 text-sm text-gray-400">
            {song.key_signature && (
              <span
                className="px-2 py-0.5 rounded-lg text-xs"
                style={{ backgroundColor: "var(--color-surface-2)" }}
              >
                {song.key_signature}
              </span>
            )}
            {song.bpm != null && (
              <span
                className="px-2 py-0.5 rounded-lg text-xs"
                style={{ backgroundColor: "var(--color-surface-2)" }}
              >
                {song.bpm} BPM
              </span>
            )}
            {song.duration_seconds > 0 && (
              <span
                className="px-2 py-0.5 rounded-lg text-xs"
                style={{ backgroundColor: "var(--color-surface-2)" }}
              >
                {formatDuration(song.duration_seconds)}
              </span>
            )}
          </div>

          {/* Action row: publish toggle (owner) + like button (non-owner, public) + delete (owner) */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            {/* Publish toggle — only for owner */}
            {isOwner && (
              <button
                onClick={() => void handlePublishToggle()}
                disabled={publishToggling}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
                style={
                  song.is_public
                    ? { backgroundColor: "rgba(0,210,255,0.1)", color: "var(--color-teal)" }
                    : { backgroundColor: "var(--color-surface-2)", color: "#9ca3af" }
                }
              >
                {publishToggling ? (
                  <span>Saving…</span>
                ) : song.is_public ? (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Make Private
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
                    </svg>
                    Make Public
                  </>
                )}
              </button>
            )}

            {/* Like button — only for non-owners on public songs */}
            {!isOwner && song.is_public && (
              <LikeButton
                songId={song.id}
                initialLiked={isLikedByMe}
                initialCount={song.like_count}
              />
            )}

            {/* Delete button — only for owner */}
            {isOwner && (
              !deleteConfirming ? (
                <button
                  onClick={() => setDeleteConfirming(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer"
                  style={{
                    backgroundColor: "rgba(255,107,107,0.1)",
                    color: "var(--color-coral)",
                  }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Delete
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Are you sure?</span>
                  <button
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                    style={{
                      backgroundColor: "var(--color-coral)",
                      color: "white",
                    }}
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                  <button
                    onClick={() => setDeleteConfirming(false)}
                    className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
                    style={{ backgroundColor: "var(--color-surface-2)" }}
                  >
                    Cancel
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Player */}
      <div
        className="rounded-2xl border p-5"
        style={{
          backgroundColor: "var(--color-surface-1)",
          borderColor: "var(--color-surface-3)",
        }}
      >
        <WaveformPlayer songId={song.id} waveformData={waveformData} />
      </div>

      {/* Lyrics + Metadata — two column on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lyrics */}
        <div
          className="rounded-2xl border p-5"
          style={{
            backgroundColor: "var(--color-surface-1)",
            borderColor: "var(--color-surface-3)",
          }}
        >
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Lyrics
          </h2>
          <LyricsDisplay lyrics={song.lyrics} />
        </div>

        {/* Metadata */}
        <div
          className="rounded-2xl border p-5"
          style={{
            backgroundColor: "var(--color-surface-1)",
            borderColor: "var(--color-surface-3)",
          }}
        >
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Details
          </h2>
          <SongMeta song={song} />
        </div>
      </div>
    </div>
  );
}
