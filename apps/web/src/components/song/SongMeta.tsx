import type { SongDetail } from "@melodia/shared";

// ─── Types ─────────────────────────────────────────────────────────────────────

type SongMetaProps = {
  song: SongDetail;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseInstruments(raw: string | null): string {
  if (!raw) return "—";
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return (parsed as string[]).join(", ");
    }
    // Might be a plain comma-separated string stored as JSON string
    return String(parsed);
  } catch {
    // Not JSON — treat as raw string (possibly comma-separated)
    return raw;
  }
}

// ─── MetaRow helper ────────────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-gray-400 text-sm">{label}</dt>
      <dd className="text-white text-sm">{value}</dd>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function SongMeta({ song }: SongMetaProps) {
  return (
    <dl className="space-y-4">
      <MetaRow label="Genre" value={song.genre} />
      <MetaRow label="Sub-genre" value={song.sub_genre} />
      <MetaRow label="Mood" value={song.mood} />
      <MetaRow label="Key" value={song.key_signature} />
      <MetaRow label="BPM" value={song.bpm != null ? String(song.bpm) : null} />
      <MetaRow label="Duration" value={formatDuration(song.duration_seconds)} />
      <MetaRow label="Time Signature" value={song.time_signature} />
      <MetaRow label="Vocal Style" value={song.vocal_style} />
      <MetaRow label="Language" value={song.vocal_language} />
      <MetaRow
        label="Instruments"
        value={parseInstruments(song.instruments)}
      />
      {song.style_tags && (
        <div className="flex flex-col gap-0.5">
          <dt className="text-gray-400 text-sm">Style</dt>
          <dd className="text-white text-sm">{song.style_tags}</dd>
        </div>
      )}
    </dl>
  );
}
