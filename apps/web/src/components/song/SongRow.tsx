import { Link } from "react-router";
import type { Song } from "@melodia/shared";

// ─── Types ─────────────────────────────────────────────────────────────────────

type SongRowProps = {
  song: Song;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getRelativeDate(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
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

// ─── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Song["status"] }) {
  const label = getStatusLabel(status);
  const generating = isGenerating(status);

  let bgColor: string;
  let textColor: string;
  let borderColor: string;

  if (status === "completed") {
    bgColor = "rgba(0,210,255,0.12)";
    textColor = "var(--color-teal)";
    borderColor = "rgba(0,210,255,0.18)";
  } else if (status === "failed") {
    bgColor = "rgba(231,76,60,0.12)";
    textColor = "var(--color-coral)";
    borderColor = "rgba(231,76,60,0.18)";
  } else {
    bgColor = "rgba(240,165,0,0.12)";
    textColor = "var(--color-amber)";
    borderColor = "rgba(240,165,0,0.18)";
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0"
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

// ─── Component ─────────────────────────────────────────────────────────────────

export function SongRow({ song }: SongRowProps) {
  return (
    <Link
      to={`/studio/song/${song.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-all group relative"
      style={{
        borderLeft: "2px solid transparent",
        transition: "background-color 0.2s ease, border-color 0.2s ease",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.backgroundColor = "rgba(240,165,0,0.04)";
        el.style.borderLeftColor = "var(--color-amber)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.backgroundColor = "transparent";
        el.style.borderLeftColor = "transparent";
      }}
    >
      {/* 44×44 thumbnail */}
      <div
        className="w-11 h-11 rounded-lg overflow-hidden shrink-0"
        style={{ backgroundColor: "var(--color-surface-3)" }}
      >
        {song.artwork_url ? (
          <img
            src={song.artwork_url}
            alt={`${song.title} artwork`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-gray-600"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}
      </div>

      {/* Title + genre */}
      <div className="flex-1 min-w-0">
        <p
          className="text-white text-sm font-semibold truncate transition-colors"
          style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}
        >
          {song.title}
        </p>
        {song.genre && (
          <p className="text-xs text-gray-600 capitalize truncate">{song.genre}</p>
        )}
      </div>

      {/* Genre badge — wider screens */}
      {song.genre && (
        <span
          className="shrink-0 px-2 py-0.5 rounded-full text-xs capitalize hidden lg:inline-flex"
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            color: "#6b7280",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {song.genre}
        </span>
      )}

      {/* Status badge */}
      <StatusBadge status={song.status} />

      {/* Duration */}
      <span
        className="shrink-0 text-xs tabular-nums font-mono w-10 text-right hidden sm:block"
        style={{ color: "#4b5563" }}
      >
        {formatDuration(song.duration_seconds)}
      </span>

      {/* Relative date */}
      <span
        className="shrink-0 text-xs w-20 text-right hidden md:block"
        style={{ color: "#4b5563" }}
      >
        {getRelativeDate(song.created_at)}
      </span>
    </Link>
  );
}
