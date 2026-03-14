// ─── Shimmer keyframe injection ────────────────────────────────────────────────

const SHIMMER_CSS = `
@keyframes genreShimmer {
  0%, 100% { background-position: 0% 50%; }
  50%       { background-position: 100% 50%; }
}
.genre-card {
  background-size: 200% 200%;
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}
.genre-card:hover {
  animation: genreShimmer 2.5s ease infinite;
  transform: translateY(-5px) scale(1.02);
  box-shadow: 0 16px 48px rgba(0,0,0,0.5);
  border-color: rgba(255,255,255,0.2) !important;
}
`;

let shimmerInjected = false;
function injectShimmerStyle() {
  if (shimmerInjected || typeof document === "undefined") return;
  shimmerInjected = true;
  const el = document.createElement("style");
  el.textContent = SHIMMER_CSS;
  document.head.appendChild(el);
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type GenreGridProps = {
  onSelectGenre: (genre: string) => void;
};

// ─── Genre gradient map ────────────────────────────────────────────────────────
// African genres: warmer, richer — golds, deep reds, emeralds
// Western genres: cooler tones

const GENRE_GRADIENTS: Record<string, [string, string]> = {
  // African genres — warm, vibrant
  afrobeats:    ["#F0A500", "#b45309"],
  "afro-fusion":["#f59e0b", "#ca8a04"],
  "afro-soul":  ["#9333ea", "#db2777"],
  highlife:     ["#15803d", "#0d9488"],
  hiplife:      ["#F0A500", "#16a34a"],
  amapiano:     ["#0d9488", "#2563eb"],
  kizomba:      ["#be185d", "#9333ea"],
  zouk:         ["#1d4ed8", "#7c3aed"],
  "afro-house": ["#0d9488", "#7c3aed"],
  // Global genres — cooler, more neutral
  "hip-hop":    ["#374151", "#111827"],
  rap:          ["#374151", "#7f1d1d"],
  "r&b":        ["#7e22ce", "#be185d"],
  soul:         ["#4338ca", "#6d28d9"],
  pop:          ["#db2777", "#9333ea"],
  edm:          ["#2563eb", "#0d9488"],
  electronic:   ["#1d4ed8", "#5b21b6"],
  dancehall:    ["#16a34a", "#ca8a04"],
  reggae:       ["#15803d", "#a16207"],
  gospel:       ["#b45309", "#ca8a04"],
  worship:      ["#d97706", "#f59e0b"],
  jazz:         ["#3730a3", "#1d4ed8"],
  blues:        ["#1d4ed8", "#3730a3"],
  country:      ["#a16207", "#92400e"],
  folk:         ["#78350f", "#92400e"],
  rock:         ["#1f2937", "#7f1d1d"],
  alternative:  ["#374151", "#4c1d95"],
  classical:    ["#312e81", "#1e3a8a"],
  "lo-fi":      ["#374151", "#1f2937"],
  trap:         ["#1f2937", "#7f1d1d"],
  drill:        ["#111827", "#1e1b4b"],
};

// African genres displayed first
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

// Genre emoji accents for extra character
const GENRE_EMOJI: Record<string, string> = {
  afrobeats:    "🥁",
  "afro-fusion":"✨",
  "afro-soul":  "🎷",
  highlife:     "🎺",
  hiplife:      "🎤",
  amapiano:     "🎹",
  kizomba:      "💃",
  zouk:         "🌊",
  "afro-house": "🔥",
  "hip-hop":    "🎧",
  rap:          "🎤",
  "r&b":        "🎵",
  soul:         "🎶",
  pop:          "⭐",
  edm:          "⚡",
  electronic:   "🤖",
  dancehall:    "🌴",
  reggae:       "☀️",
  gospel:       "🙏",
  worship:      "🕊️",
  jazz:         "🎷",
  blues:        "🎸",
  country:      "🤠",
  folk:         "🪕",
  rock:         "🎸",
  alternative:  "🎸",
  classical:    "🎻",
  "lo-fi":      "☁️",
  trap:         "🔊",
  drill:        "💿",
};

function getGradientStyle(genre: string): string {
  const colors = GENRE_GRADIENTS[genre];
  if (colors) {
    return `linear-gradient(135deg, ${colors[0]}cc, ${colors[1]}cc)`;
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

// ─── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span
        className="text-xs font-bold uppercase tracking-widest"
        style={{ color: "var(--color-amber)" }}
      >
        {children}
      </span>
      <div className="flex-1 h-px" style={{ backgroundColor: "rgba(240,165,0,0.15)" }} />
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function GenreGrid({ onSelectGenre }: GenreGridProps) {
  injectShimmerStyle();

  const africanGenres = ORDERED_GENRES.filter((g) => AFRICAN_GENRES.includes(g));
  const globalGenres  = ORDERED_GENRES.filter((g) => !AFRICAN_GENRES.includes(g));

  function renderGenre(genre: string) {
    const emoji = GENRE_EMOJI[genre] ?? "🎵";
    const isAfrican = AFRICAN_GENRES.includes(genre);

    return (
      <button
        key={genre}
        onClick={() => onSelectGenre(genre)}
        className="genre-card rounded-2xl h-24 flex flex-col items-center justify-center gap-1.5 cursor-pointer border"
        style={{
          background: getGradientStyle(genre),
          textShadow: "0 1px 4px rgba(0,0,0,0.7)",
          borderColor: "rgba(255,255,255,0.07)",
        }}
        aria-label={`Browse ${formatGenreName(genre)} songs`}
      >
        <span className="text-xl leading-none" aria-hidden="true">{emoji}</span>
        <span
          className="text-white font-bold text-xs text-center px-2 leading-tight"
          style={{
            fontFamily: "'Outfit', 'Sora', sans-serif",
            fontSize: isAfrican ? "0.8rem" : "0.72rem",
            letterSpacing: "0.01em",
          }}
        >
          {formatGenreName(genre)}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-6">
      {/* African genres */}
      <div>
        <SectionLabel>African Genres</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {africanGenres.map(renderGenre)}
        </div>
      </div>

      {/* Global genres */}
      <div>
        <SectionLabel>Global Genres</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {globalGenres.map(renderGenre)}
        </div>
      </div>
    </div>
  );
}
