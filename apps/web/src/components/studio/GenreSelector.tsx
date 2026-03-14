import { GENRES } from "@melodia/shared";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GenreSelectorProps {
  value: string | undefined;
  onChange: (genre: string | undefined) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AFRICAN_GENRES = new Set([
  "afrobeats",
  "afro-fusion",
  "afro-soul",
  "highlife",
  "hiplife",
  "amapiano",
  "afro-house",
  "kizomba",
  "zouk",
]);

const africanGenres = GENRES.filter((g) => AFRICAN_GENRES.has(g));
const otherGenres = [...GENRES]
  .filter((g) => !AFRICAN_GENRES.has(g))
  .sort((a, b) => a.localeCompare(b));

function formatGenreLabel(genre: string): string {
  return genre
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GenreSelector({ value, onChange }: GenreSelectorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    onChange(v === "" ? undefined : v);
  };

  return (
    <select
      value={value ?? ""}
      onChange={handleChange}
      className="w-full bg-surface-2 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber border border-surface-3 appearance-none cursor-pointer"
    >
      <option value="">Any genre</option>

      <optgroup label="African">
        {africanGenres.map((genre) => (
          <option key={genre} value={genre}>
            {formatGenreLabel(genre)}
          </option>
        ))}
      </optgroup>

      <optgroup label="All Genres">
        {otherGenres.map((genre) => (
          <option key={genre} value={genre}>
            {formatGenreLabel(genre)}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
