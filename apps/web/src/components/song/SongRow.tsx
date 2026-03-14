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
      return "Completed";
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

  let colorClasses = "";
  let dotColor = "";

  if (status === "completed") {
    colorClasses = "bg-teal/20 text-teal";
    dotColor = "bg-teal";
  } else if (status === "failed") {
    colorClasses = "bg-coral/20 text-coral";
    dotColor = "bg-coral";
  } else {
    colorClasses = "bg-amber/20 text-amber";
    dotColor = "bg-amber";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${colorClasses} shrink-0`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${generating ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function SongRow({ song }: SongRowProps) {
  return (
    <Link
      to={`/studio/song/${song.id}`}
      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface-2 transition-colors group"
    >
      {/* 40×40 thumbnail */}
      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-surface-3">
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

      {/* Title */}
      <p className="flex-1 min-w-0 text-white text-sm font-medium truncate group-hover:text-amber/90 transition-colors">
        {song.title}
      </p>

      {/* Genre badge */}
      {song.genre && (
        <span className="shrink-0 px-2 py-0.5 rounded-full bg-surface-3 text-gray-400 text-xs capitalize hidden sm:inline-flex">
          {song.genre}
        </span>
      )}

      {/* Status badge */}
      <StatusBadge status={song.status} />

      {/* Duration */}
      <span className="shrink-0 text-gray-400 text-xs tabular-nums w-12 text-right hidden sm:block">
        {formatDuration(song.duration_seconds)}
      </span>

      {/* Relative date */}
      <span className="shrink-0 text-gray-500 text-xs w-20 text-right hidden md:block">
        {getRelativeDate(song.created_at)}
      </span>
    </Link>
  );
}
