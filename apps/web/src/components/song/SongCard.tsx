import { Link } from "react-router";
import type { Song } from "@melodia/shared";

// ─── Types ─────────────────────────────────────────────────────────────────────

type SongCardProps = {
  song: Song;
  compact?: boolean;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
  afrobeats: "from-amber/30 to-orange-700/30",
  "afro-fusion": "from-amber/30 to-yellow-600/30",
  "afro-soul": "from-purple-600/30 to-pink-600/30",
  highlife: "from-green-600/30 to-teal-600/30",
  hiplife: "from-amber/30 to-green-600/30",
  "hip-hop": "from-gray-700/50 to-gray-900/50",
  rap: "from-gray-700/50 to-red-900/30",
  "r&b": "from-purple-700/30 to-pink-600/30",
  soul: "from-indigo-600/30 to-purple-600/30",
  pop: "from-pink-600/30 to-purple-600/30",
  edm: "from-blue-600/30 to-teal/30",
  electronic: "from-blue-700/30 to-purple-700/30",
  dancehall: "from-green-600/30 to-yellow-600/30",
  reggae: "from-green-700/30 to-yellow-700/30",
  gospel: "from-amber/30 to-yellow-600/30",
  jazz: "from-indigo-700/30 to-blue-700/30",
  blues: "from-blue-700/30 to-indigo-700/30",
  amapiano: "from-teal/30 to-blue-600/30",
};

function getGradient(genre: string | null): string {
  if (genre && GENRE_GRADIENTS[genre]) return GENRE_GRADIENTS[genre];
  return "from-surface-3 to-surface-2";
}

// ─── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status, generating }: { status: Song["status"]; generating: boolean }) {
  const label = getStatusLabel(status);

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
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${colorClasses}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${dotColor} ${generating ? "animate-pulse" : ""}`}
      />
      {label}
    </span>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function SongCard({ song, compact = false }: SongCardProps) {
  const generating = isGenerating(song.status);
  const gradient = getGradient(song.genre);

  return (
    <Link
      to={`/studio/song/${song.id}`}
      className="block bg-surface-1 rounded-2xl border border-surface-3 hover:border-amber/30 transition-colors overflow-hidden group"
    >
      {/* Artwork */}
      <div
        className={`relative w-full ${compact ? "aspect-square" : "aspect-square"} overflow-hidden`}
      >
        {song.artwork_url ? (
          <img
            src={song.artwork_url}
            alt={`${song.title} artwork`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
          >
            {/* Music note icon */}
            <svg
              className="w-10 h-10 text-gray-500 opacity-50"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}

        {/* Status badge overlay */}
        <div className="absolute top-2 right-2">
          <StatusBadge status={song.status} generating={generating} />
        </div>
      </div>

      {/* Card body */}
      <div className={`${compact ? "p-2" : "p-3"}`}>
        <p className="text-white font-medium text-sm line-clamp-1">{song.title}</p>

        {song.genre && (
          <p className="text-gray-400 text-xs mt-0.5 capitalize">{song.genre}</p>
        )}

        {/* Duration — hidden in compact mode */}
        {!compact && song.duration_seconds > 0 && (
          <p className="text-gray-500 text-xs mt-1 tabular-nums">
            {formatDuration(song.duration_seconds)}
          </p>
        )}
      </div>
    </Link>
  );
}
