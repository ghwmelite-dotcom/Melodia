import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useAuth } from "../hooks/useAuth.js";
import { useSongs } from "../hooks/useSongs.js";
import { GenerationProgress } from "../components/song/GenerationProgress.js";
import { WaveformPlayer } from "../components/player/WaveformPlayer.js";
import { LyricsDisplay } from "../components/song/LyricsDisplay.js";
import { SongMeta } from "../components/song/SongMeta.js";
import { LikeButton } from "../components/song/LikeButton.js";
import { VariationTabs } from "../components/song/VariationTabs.js";
import { RegenerateModal } from "../components/song/RegenerateModal.js";
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
  afrobeats: ["rgba(240,165,0,0.4)", "rgba(194,65,12,0.4)"],
  "afro-fusion": ["rgba(240,165,0,0.4)", "rgba(202,138,4,0.4)"],
  "afro-soul": ["rgba(147,51,234,0.4)", "rgba(219,39,119,0.4)"],
  highlife: ["rgba(22,163,74,0.4)", "rgba(13,148,136,0.4)"],
  amapiano: ["rgba(13,148,136,0.4)", "rgba(37,99,235,0.4)"],
  "hip-hop": ["rgba(75,85,99,0.6)", "rgba(17,24,39,0.6)"],
  pop: ["rgba(219,39,119,0.4)", "rgba(147,51,234,0.4)"],
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
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
      <div className="relative w-12 h-12">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: "2px solid rgba(240,165,0,0.15)",
          }}
        />
        <div
          className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--color-amber)", borderTopColor: "transparent" }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-sm">
          🎵
        </div>
      </div>
      <p className="text-sm text-gray-500" style={{ fontFamily: "var(--font-display)" }}>
        Loading…
      </p>
    </div>
  );
}

// ─── Visibility Badge ──────────────────────────────────────────────────────────

function VisibilityBadge({ isPublic }: { isPublic: boolean }) {
  if (isPublic) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{
          background: "rgba(0,210,255,0.1)",
          border: "1px solid rgba(0,210,255,0.2)",
          color: "var(--color-teal)",
          fontFamily: "var(--font-display)",
        }}
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Public
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "#6b7280",
        fontFamily: "var(--font-display)",
      }}
    >
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
      </svg>
      Private
    </span>
  );
}

// ─── Action button helper ──────────────────────────────────────────────────────

interface ActionBtnProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: "default" | "teal" | "danger" | "danger-confirm";
  title?: string;
}

function ActionBtn({ onClick, disabled, children, variant = "default", title }: ActionBtnProps) {
  const styles: Record<string, { background: string; border: string; color: string }> = {
    default: {
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      color: "#9ca3af",
    },
    teal: {
      background: "rgba(0,210,255,0.08)",
      border: "1px solid rgba(0,210,255,0.2)",
      color: "var(--color-teal)",
    },
    danger: {
      background: "rgba(231,76,60,0.08)",
      border: "1px solid rgba(231,76,60,0.2)",
      color: "var(--color-coral)",
    },
    "danger-confirm": {
      background: "var(--color-coral)",
      border: "1px solid var(--color-coral)",
      color: "white",
    },
  };

  const s = styles[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      style={{
        background: s.background,
        border: s.border,
        color: s.color,
        fontFamily: "var(--font-display)",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLElement).style.filter = "brightness(1.15)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.filter = "";
        (e.currentTarget as HTMLElement).style.transform = "";
      }}
    >
      {children}
    </button>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SongView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const songs = useSongs();

  const [song, setSong] = useState<SongDetail | null>(null);
  const [loadingState, setLoadingState] = useState<"loading" | "loaded" | "error">("loading");
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publishToggling, setPublishToggling] = useState(false);
  const [playingVariation, setPlayingVariation] = useState(0);
  const [isRegenerateOpen, setIsRegenerateOpen] = useState(false);

  const fetchSong = useCallback(async () => {
    if (!id) return;
    try {
      const data = await songs.getSong(id);
      setSong(data);
      setLoadingState("loaded");
      setPlayingVariation(data.variation_index ?? 0);
    } catch {
      setLoadingState("error");
    }
  }, [id, songs]);

  useEffect(() => {
    void fetchSong();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleGenerationComplete = useCallback(async () => {
    await fetchSong();
    await refresh();
  }, [fetchSong, refresh]);

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

  const handleSetPrimary = useCallback(
    async (variationIndex: number) => {
      if (!id) return;
      try {
        await songs.selectVariation(id, variationIndex);
        await fetchSong();
      } catch {
        // Silently fail — variation still playable
      }
    },
    [id, songs, fetchSong]
  );

  const handleRegenerated = useCallback(async () => {
    await fetchSong();
    await refresh();
  }, [fetchSong, refresh]);

  const handlePublishToggle = useCallback(async () => {
    if (!song || publishToggling) return;
    setPublishToggling(true);
    try {
      const updated = await songs.updateSong(song.id, { is_public: !song.is_public });
      setSong(updated);
    } catch {
      // Silently fail
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
      <div className="text-center py-20 space-y-5">
        <div className="text-5xl opacity-30">🎵</div>
        <div>
          <p className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
            Song not found
          </p>
          <p className="text-gray-500 text-sm mt-1">
            This song doesn&apos;t exist or you don&apos;t have access to it.
          </p>
        </div>
        <Link
          to="/library"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
          style={{
            background: "rgba(240,165,0,0.1)",
            border: "1px solid rgba(240,165,0,0.2)",
            color: "var(--color-amber)",
            fontFamily: "var(--font-display)",
          }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
            className="inline-flex items-center gap-1.5 text-sm transition-colors mb-5"
            style={{ color: "rgba(156,163,175,0.7)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(156,163,175,0.7)"; }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Library
          </Link>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
            Generation Failed
          </h1>
        </div>

        <div
          className="rounded-2xl p-6 space-y-4"
          style={{
            background: "linear-gradient(180deg, rgba(231,76,60,0.08) 0%, rgba(231,76,60,0.03) 100%)",
            border: "1px solid rgba(231,76,60,0.2)",
          }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(156,163,175,0.5)" }}>
              Your prompt
            </p>
            <p
              className="text-gray-200 text-sm leading-relaxed italic"
              style={{ fontFamily: "var(--font-body)" }}
            >
              &ldquo;{song.user_prompt}&rdquo;
            </p>
          </div>

          <div
            className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
            style={{
              background: "rgba(13,148,136,0.08)",
              border: "1px solid rgba(13,148,136,0.2)",
              color: "var(--color-teal)",
            }}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Your credits have been refunded.
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => void navigate(`/studio?prompt=${encodeURIComponent(song.user_prompt)}`)}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold transition-all duration-200"
            style={{
              background: "linear-gradient(135deg, var(--color-amber) 0%, #D4920A 100%)",
              color: "var(--color-charcoal)",
              fontFamily: "var(--font-display)",
              boxShadow: "0 4px 20px rgba(240,165,0,0.3)",
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            Try Again
          </button>
          <Link
            to="/library"
            className="flex items-center justify-center px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-150"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#9ca3af",
              fontFamily: "var(--font-display)",
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
            className="inline-flex items-center gap-1.5 text-sm transition-colors mb-5"
            style={{ color: "rgba(156,163,175,0.7)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(156,163,175,0.7)"; }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Library
          </Link>
          <h1
            className="text-2xl font-bold text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {song.title || "Creating your song…"}
          </h1>
          {song.user_prompt && (
            <p className="mt-1.5 text-sm italic" style={{ color: "rgba(156,163,175,0.7)" }}>
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
  const waveformData: number[] | null = null;
  const variationCount = song.variation_count ?? 1;
  const primaryIndex = song.variation_index ?? 0;

  return (
    <>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Back link */}
        <Link
          to="/library"
          className="inline-flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: "rgba(156,163,175,0.7)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(156,163,175,0.7)"; }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Library
        </Link>

        {/* Top section: artwork + title + actions */}
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Artwork with ambient glow */}
          <div className="shrink-0 relative">
            {/* Ambient glow behind artwork */}
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                background: "radial-gradient(ellipse at center, rgba(240,165,0,0.25) 0%, transparent 70%)",
                filter: "blur(16px)",
                transform: "scale(1.1) translateY(6px)",
                zIndex: 0,
              }}
              aria-hidden="true"
            />

            {song.artwork_url ? (
              <img
                src={song.artwork_url}
                alt={`${song.title} artwork`}
                className="relative z-10 w-full sm:w-52 sm:h-52 rounded-2xl object-cover transition-transform duration-500"
                style={{
                  boxShadow: "0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform =
                    "rotate3d(0.3, -0.8, 0, 8deg) scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "rotate3d(0,0,0,0deg) scale(1)";
                }}
              />
            ) : (
              <div
                className="relative z-10 w-full sm:w-52 sm:h-52 rounded-2xl flex items-center justify-center transition-transform duration-500"
                style={{
                  background: artworkGradient(song.genre),
                  boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform =
                    "rotate3d(0.3, -0.8, 0, 8deg) scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "rotate3d(0,0,0,0deg) scale(1)";
                }}
              >
                <svg
                  className="w-20 h-20 opacity-20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  style={{ color: "white" }}
                  aria-hidden="true"
                >
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
            )}
          </div>

          {/* Song info */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Title + visibility */}
            <div className="flex items-start gap-2 flex-wrap">
              <h1
                className="text-3xl font-bold text-white leading-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {song.title}
              </h1>
              {isOwner && <VisibilityBadge isPublic={song.is_public} />}
            </div>

            {/* Genre/subgenre */}
            {(song.genre || song.sub_genre) && (
              <p
                className="text-sm capitalize"
                style={{ color: "rgba(156,163,175,0.8)" }}
              >
                {[song.genre, song.sub_genre].filter(Boolean).join(" · ")}
              </p>
            )}

            {/* Key / BPM / Duration pills */}
            <div className="flex flex-wrap gap-2">
              {song.key_signature && (
                <span
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{
                    background: "rgba(240,165,0,0.1)",
                    border: "1px solid rgba(240,165,0,0.2)",
                    color: "var(--color-amber-light)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  🎹 {song.key_signature}
                </span>
              )}
              {song.bpm != null && (
                <span
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{
                    background: "rgba(240,165,0,0.1)",
                    border: "1px solid rgba(240,165,0,0.2)",
                    color: "var(--color-amber-light)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  ⏱ {song.bpm} BPM
                </span>
              )}
              {song.duration_seconds > 0 && (
                <span
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(156,163,175,0.8)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {formatDuration(song.duration_seconds)}
                </span>
              )}
            </div>

            {/* Action row */}
            <div className="pt-1 flex flex-wrap items-center gap-2">
              {/* Publish toggle */}
              {isOwner && (
                <ActionBtn
                  onClick={() => void handlePublishToggle()}
                  disabled={publishToggling}
                  variant={song.is_public ? "teal" : "default"}
                  title={song.is_public ? "Make private" : "Make public"}
                >
                  {publishToggling ? (
                    <span>Saving…</span>
                  ) : song.is_public ? (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      Make Private
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
                      </svg>
                      Make Public
                    </>
                  )}
                </ActionBtn>
              )}

              {/* Regenerate */}
              {isOwner && (
                <ActionBtn
                  onClick={() => setIsRegenerateOpen(true)}
                  title="Regenerate this song"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Regenerate
                </ActionBtn>
              )}

              {/* Like button */}
              {!isOwner && song.is_public && (
                <LikeButton
                  songId={song.id}
                  initialLiked={isLikedByMe}
                  initialCount={song.like_count}
                />
              )}

              {/* Delete */}
              {isOwner && (
                !deleteConfirming ? (
                  <ActionBtn
                    onClick={() => setDeleteConfirming(true)}
                    variant="danger"
                    title="Delete song"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Delete
                  </ActionBtn>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "rgba(156,163,175,0.7)" }}>
                      Are you sure?
                    </span>
                    <ActionBtn
                      onClick={() => void handleDelete()}
                      disabled={deleting}
                      variant="danger-confirm"
                    >
                      {deleting ? "Deleting…" : "Delete"}
                    </ActionBtn>
                    <ActionBtn onClick={() => setDeleteConfirming(false)}>
                      Cancel
                    </ActionBtn>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Variation Tabs */}
        {variationCount > 1 && (
          <div
            className="rounded-2xl px-5 py-4"
            style={{
              background: "linear-gradient(180deg, var(--color-surface-2) 0%, var(--color-surface-1) 100%)",
              border: "1px solid rgba(240,165,0,0.1)",
            }}
          >
            <VariationTabs
              variationCount={variationCount}
              selectedIndex={playingVariation}
              primaryIndex={primaryIndex}
              onSelect={(i) => setPlayingVariation(i)}
              onSetPrimary={(i) => void handleSetPrimary(i)}
            />
          </div>
        )}

        {/* Player card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(180deg, var(--color-surface-2) 0%, var(--color-surface-1) 100%)",
            border: "1px solid rgba(240,165,0,0.12)",
            boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
          }}
        >
          {/* Subtle top line */}
          <div
            style={{
              height: "1px",
              background: "linear-gradient(90deg, transparent, rgba(240,165,0,0.4), transparent)",
            }}
          />
          <div className="p-5">
            <WaveformPlayer
              songId={song.id}
              waveformData={waveformData}
              variationIndex={playingVariation}
              artworkUrl={song.artwork_url ?? undefined}
            />
          </div>
        </div>

        {/* Lyrics + Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Lyrics panel */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(180deg, var(--color-surface-2) 0%, var(--color-surface-1) 100%)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="px-5 pt-5 pb-3 flex items-center gap-2 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize: "0.9rem" }}>♪</span>
              <h2
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "rgba(156,163,175,0.6)", fontFamily: "var(--font-display)" }}
              >
                Lyrics
              </h2>
            </div>
            <div className="px-5 py-4">
              <LyricsDisplay lyrics={song.lyrics} />
            </div>
          </div>

          {/* Metadata panel */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(180deg, var(--color-surface-2) 0%, var(--color-surface-1) 100%)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="px-5 pt-5 pb-3 flex items-center gap-2 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize: "0.9rem" }}>⚙</span>
              <h2
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "rgba(156,163,175,0.6)", fontFamily: "var(--font-display)" }}
              >
                Details
              </h2>
            </div>
            <div className="px-4 py-4">
              <SongMeta song={song} />
            </div>
          </div>
        </div>
      </div>

      {/* Regenerate Modal */}
      <RegenerateModal
        songId={song.id}
        isOpen={isRegenerateOpen}
        onClose={() => setIsRegenerateOpen(false)}
        onRegenerated={() => void handleRegenerated()}
      />
    </>
  );
}
