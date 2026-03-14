import { Link } from "react-router";
import type { Song } from "@melodia/shared";
import { LikeButton } from "./LikeButton.js";

// ─── Types ─────────────────────────────────────────────────────────────────────

type SongCardProps = {
  song: Song;
  compact?: boolean;
  // Social / explore props
  creatorUsername?: string;
  likeCount?: number;
  playCount?: number;
  isLiked?: boolean;
  songId?: string;
  showSocialStats?: boolean;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getStatusLabel(status: Song["status"]): string {
  switch (status) {
    case "completed":
      return "Done";
    case "failed":
      return "Failed";
    default:
      return "Generating";
  }
}

function isGenerating(status: Song["status"]): boolean {
  return (
    status === "pending" ||
    status === "generating_lyrics" ||
    status === "generating_music" ||
    status === "generating_artwork" ||
    status === "processing"
  );
}

// Genre-based gradient colors for placeholder artwork
const GENRE_GRADIENTS: Record<string, string> = {
  afrobeats: "from-amber-500/40 to-orange-700/40",
  "afro-fusion": "from-amber-500/40 to-yellow-600/40",
  "afro-soul": "from-purple-600/40 to-pink-600/40",
  highlife: "from-green-600/40 to-teal-600/40",
  hiplife: "from-amber-500/40 to-green-600/40",
  "hip-hop": "from-gray-700/60 to-gray-900/60",
  rap: "from-gray-700/60 to-red-900/40",
  "r&b": "from-purple-700/40 to-pink-600/40",
  soul: "from-indigo-600/40 to-purple-600/40",
  pop: "from-pink-600/40 to-purple-600/40",
  edm: "from-blue-600/40 to-teal-500/40",
  electronic: "from-blue-700/40 to-purple-700/40",
  dancehall: "from-green-600/40 to-yellow-600/40",
  reggae: "from-green-700/40 to-yellow-700/40",
  gospel: "from-amber-500/40 to-yellow-600/40",
  jazz: "from-indigo-700/40 to-blue-700/40",
  blues: "from-blue-700/40 to-indigo-700/40",
  amapiano: "from-teal-500/40 to-blue-600/40",
};

function getGradient(genre: string | null): string {
  if (genre && GENRE_GRADIENTS[genre]) return GENRE_GRADIENTS[genre]!;
  return "from-gray-800/60 to-gray-900/60";
}

// ─── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status, generating }: { status: Song["status"]; generating: boolean }) {
  const label = getStatusLabel(status);

  let bgColor = "";
  let textColor = "";
  let borderColor = "";

  if (status === "completed") {
    bgColor = "rgba(0,210,255,0.15)";
    textColor = "var(--color-teal)";
    borderColor = "rgba(0,210,255,0.2)";
  } else if (status === "failed") {
    bgColor = "rgba(231,76,60,0.15)";
    textColor = "var(--color-coral)";
    borderColor = "rgba(231,76,60,0.2)";
  } else {
    bgColor = "rgba(240,165,0,0.15)";
    textColor = "var(--color-amber)";
    borderColor = "rgba(240,165,0,0.2)";
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold backdrop-blur-sm"
      style={{ backgroundColor: bgColor, color: textColor, border: `1px solid ${borderColor}` }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${generating ? "animate-pulse" : ""}`}
        style={{ backgroundColor: textColor }}
      />
      {label}
    </span>
  );
}

// ─── Play overlay ──────────────────────────────────────────────────────────────

function PlayOverlay() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
      style={{ background: "rgba(0,0,0,0.35)" }}
      aria-hidden="true"
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          background: "rgba(240,165,0,0.85)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 4px 20px rgba(240,165,0,0.5)",
        }}
      >
        <svg className="w-5 h-5 text-black ml-0.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function SongCard({
  song,
  compact = false,
  creatorUsername,
  likeCount,
  playCount,
  isLiked,
  songId,
  showSocialStats = false,
}: SongCardProps) {
  const generating = isGenerating(song.status);
  const gradient = getGradient(song.genre);

  return (
    <Link
      to={`/studio/song/${song.id}`}
      className="block rounded-2xl border overflow-hidden group"
      style={{
        backgroundColor: "var(--color-surface-1)",
        borderColor: "rgba(255,255,255,0.06)",
        transition: "transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.transform = "translateY(-6px)";
        el.style.boxShadow =
          "0 20px 60px rgba(0,0,0,0.45), 0 0 30px rgba(240,165,0,0.1)";
        el.style.borderColor = "rgba(240,165,0,0.25)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
        el.style.borderColor = "rgba(255,255,255,0.06)";
      }}
    >
      {/* Artwork */}
      <div className="relative w-full aspect-square overflow-hidden">
        {song.artwork_url ? (
          <img
            src={song.artwork_url}
            alt={`${song.title} artwork`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
          >
            <svg
              className="w-12 h-12 text-white opacity-20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}

        {/* Play overlay on hover */}
        <PlayOverlay />

        {/* Status badge — floating top-right */}
        <div className="absolute top-2 right-2 pointer-events-none">
          <StatusBadge status={song.status} generating={generating} />
        </div>
      </div>

      {/* Card body */}
      <div className={`${compact ? "p-2.5" : "p-3.5"} space-y-1.5`}>
        {/* Title */}
        <p
          className="text-white font-semibold text-sm line-clamp-1 leading-snug"
          style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}
        >
          {song.title}
        </p>

        {/* Creator or genre sub-line */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            {showSocialStats && creatorUsername ? (
              <Link
                to={`/profile/${creatorUsername}`}
                onClick={(e) => e.stopPropagation()}
                className="text-xs transition-colors truncate block"
                style={{ color: "#6b7280" }}
                onMouseEnter={(e) =>
                  ((e.target as HTMLElement).style.color = "var(--color-amber)")
                }
                onMouseLeave={(e) =>
                  ((e.target as HTMLElement).style.color = "#6b7280")
                }
              >
                @{creatorUsername}
              </Link>
            ) : song.genre ? (
              <span className="text-xs text-gray-500 capitalize truncate block">
                {song.genre}
              </span>
            ) : null}
          </div>

          {/* Duration */}
          {!compact && song.duration_seconds > 0 && (
            <span className="text-xs text-gray-600 tabular-nums flex-shrink-0 font-mono">
              {formatDuration(song.duration_seconds)}
            </span>
          )}
        </div>

        {/* Social stats row */}
        {showSocialStats && (
          <div
            className="flex items-center justify-between pt-1"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            {/* Play count */}
            <div className="flex items-center gap-1 text-xs text-gray-600">
              {playCount !== undefined && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span className="tabular-nums font-medium">{formatCount(playCount)}</span>
                </span>
              )}
            </div>

            {/* Like button */}
            {songId && likeCount !== undefined && (
              <LikeButton
                songId={songId}
                initialLiked={isLiked ?? false}
                initialCount={likeCount}
              />
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
