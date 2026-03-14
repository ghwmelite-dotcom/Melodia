// ─── Types ─────────────────────────────────────────────────────────────────────

type GenreGridProps = {
  onSelectGenre: (genre: string) => void;
};

// ─── Genre gradient map (same logic as SongCard) ──────────────────────────────

const GENRE_GRADIENTS: Record<string, [string, string]> = {
  // African genres first
  afrobeats: ["#F0A500", "#b45309"],
  "afro-fusion": ["#F0A500", "#ca8a04"],
  "afro-soul": ["#9333ea", "#db2777"],
  highlife: ["#16a34a", "#0d9488"],
  hiplife: ["#F0A500", "#16a34a"],
  amapiano: ["#0d9488", "#2563eb"],
  kizomba: ["#9333ea", "#e11d48"],
  zouk: ["#2563eb", "#7c3aed"],
  "afro-house": ["#0d9488", "#9333ea"],
  // Global genres
  "hip-hop": ["#4b5563", "#111827"],
  rap: ["#374151", "#7f1d1d"],
  "r&b": ["#7e22ce", "#be185d"],
  soul: ["#4338ca", "#7c3aed"],
  pop: ["#db2777", "#9333ea"],
  edm: ["#2563eb", "#0d9488"],
  electronic: ["#1d4ed8", "#6d28d9"],
  dancehall: ["#16a34a", "#ca8a04"],
  reggae: ["#15803d", "#a16207"],
  gospel: ["#b45309", "#ca8a04"],
  worship: ["#d97706", "#f59e0b"],
  jazz: ["#3730a3", "#1d4ed8"],
  blues: ["#1d4ed8", "#3730a3"],
  country: ["#a16207", "#92400e"],
  folk: ["#78350f", "#92400e"],
  rock: ["#1f2937", "#7f1d1d"],
  alternative: ["#374151", "#4c1d95"],
  classical: ["#312e81", "#1e3a8a"],
  "lo-fi": ["#374151", "#1f2937"],
  trap: ["#1f2937", "#7f1d1d"],
  drill: ["#111827", "#1e1b4b"],
};

// African genres shown first (in this order), then rest alphabetically
const AFRICAN_GENRES = [
  "afrobeats",
  "afro-fusion",
  "afro-soul",
  "highlife",
  "hiplife",
  "amapiano",
  "kizomba",
  "zouk",
  "afro-house",
];

const ALL_GENRES = Object.keys(GENRE_GRADIENTS);
const NON_AFRICAN = ALL_GENRES.filter((g) => !AFRICAN_GENRES.includes(g)).sort();
const ORDERED_GENRES = [...AFRICAN_GENRES, ...NON_AFRICAN];

function getGradientStyle(genre: string): string {
  const colors = GENRE_GRADIENTS[genre];
  if (colors) {
    return `linear-gradient(135deg, ${colors[0]}99, ${colors[1]}99)`;
  }
  return "linear-gradient(135deg, var(--color-surface-3), var(--color-surface-2))";
}

function formatGenreName(genre: string): string {
  return genre
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .replace("&B", "& B")
    .replace("R & B", "R&B");
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function GenreGrid({ onSelectGenre }: GenreGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {ORDERED_GENRES.map((genre) => (
        <button
          key={genre}
          onClick={() => onSelectGenre(genre)}
          className="rounded-2xl h-24 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform border border-white/5 hover:border-white/20"
          style={{
            background: getGradientStyle(genre),
            textShadow: "0 1px 3px rgba(0,0,0,0.6)",
          }}
          aria-label={`Browse ${formatGenreName(genre)} songs`}
        >
          <span className="text-white font-bold text-sm text-center px-2 leading-tight">
            {formatGenreName(genre)}
          </span>
        </button>
      ))}
    </div>
  );
}
