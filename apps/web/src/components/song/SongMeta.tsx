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
    return String(parsed);
  } catch {
    return raw;
  }
}

// ─── Field icons (SVG inline) ───────────────────────────────────────────────────

function IconGenre() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
      <path d="M12.65 10A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 0 0 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
    </svg>
  );
}

function IconBPM() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
      <path d="M13 2.05V4.05C17.39 4.59 20.5 8.58 19.96 12.97C19.5 16.61 16.64 19.5 13 19.93V21.93C18.5 21.38 22.5 16.5 21.95 11C21.5 6.25 17.73 2.5 13 2.05M5.67 19.74C7.18 21 9 21.86 11 22V20C9.58 19.82 8.27 19.26 7.1 18.38L5.67 19.74M7.1 5.74C8.27 4.86 9.58 4.3 11 4.06V2.06C9 2.19 7.18 3.05 5.67 4.26L7.1 5.74M5.69 7.1L4.27 5.68C3.04 7.18 2.19 9 2.05 11H4.05C4.24 9.58 4.8 8.27 5.69 7.1M4.06 13H2.06C2.2 15 3.05 16.81 4.27 18.32L5.69 16.9C4.8 15.73 4.24 14.42 4.06 13M12 13.5C11.17 13.5 10.5 12.83 10.5 12C10.5 11.17 11.17 10.5 12 10.5C12.83 10.5 13.5 11.17 13.5 12C13.5 12.83 12.83 13.5 12 13.5M12 8.5C9.52 8.5 7.5 10.52 7.5 13C7.5 15.03 8.8 16.77 10.62 17.34L11.25 15.43C10.23 15.12 9.5 14.14 9.5 13C9.5 11.62 10.62 10.5 12 10.5C13.38 10.5 14.5 11.62 14.5 13C14.5 14.14 13.77 15.12 12.75 15.43L13.38 17.34C15.2 16.77 16.5 15.03 16.5 13C16.5 10.52 14.48 8.5 12 8.5Z" />
    </svg>
  );
}

function IconDuration() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
    </svg>
  );
}

function IconMood() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
    </svg>
  );
}

function IconVocal() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
      <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
    </svg>
  );
}

function IconLanguage() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
      <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
    </svg>
  );
}

function IconInstruments() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
      <path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z" />
    </svg>
  );
}

function IconTimeSignature() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z" />
    </svg>
  );
}

function IconStyle() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
      <path d="M12 22C6.49 22 2 17.51 2 12S6.49 2 12 2s10 4.04 10 9c0 3.31-2.69 6-6 6h-1.77c-.28 0-.5.22-.5.5 0 .12.05.23.13.33.41.47.64 1.06.64 1.67A2.5 2.5 0 0 1 12 22zm0-18c-4.41 0-8 3.59-8 8s3.59 8 8 8c.28 0 .5-.22.5-.5a.54.54 0 0 0-.14-.35c-.41-.46-.63-1.05-.63-1.65A2.5 2.5 0 0 1 14.5 15H16c2.21 0 4-1.79 4-4 0-3.86-3.59-7-8-7z" /><circle cx="6.5" cy="11.5" r="1.5" /><circle cx="9.5" cy="7.5" r="1.5" /><circle cx="14.5" cy="7.5" r="1.5" /><circle cx="17.5" cy="11.5" r="1.5" />
    </svg>
  );
}

// ─── MetaRow helper ────────────────────────────────────────────────────────────

interface MetaRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  accent?: boolean;
}

function MetaRow({ icon, label, value, accent = false }: MetaRowProps) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150"
      style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(240,165,0,0.05)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.02)";
      }}
    >
      {/* Icon container */}
      <div
        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
        style={{
          backgroundColor: accent
            ? "rgba(240,165,0,0.15)"
            : "rgba(255,255,255,0.06)",
          color: accent ? "var(--color-amber)" : "rgba(255,255,255,0.4)",
        }}
      >
        {icon}
      </div>

      {/* Label + value */}
      <div className="flex-1 min-w-0">
        <dt
          className="text-xs font-medium uppercase tracking-wider mb-0.5"
          style={{ color: "rgba(156,163,175,0.8)", fontFamily: "var(--font-display)" }}
        >
          {label}
        </dt>
        <dd
          className="text-sm font-medium text-white break-words"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {value}
        </dd>
      </div>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function SongMeta({ song }: SongMetaProps) {
  return (
    <dl className="space-y-1">
      <MetaRow icon={<IconGenre />} label="Genre" value={song.genre} accent />
      <MetaRow icon={<IconGenre />} label="Sub-genre" value={song.sub_genre} />
      <MetaRow icon={<IconMood />} label="Mood" value={song.mood} />
      <MetaRow icon={<IconKey />} label="Key" value={song.key_signature} accent />
      <MetaRow icon={<IconBPM />} label="BPM" value={song.bpm != null ? `${String(song.bpm)} bpm` : null} accent />
      <MetaRow icon={<IconDuration />} label="Duration" value={formatDuration(song.duration_seconds)} />
      <MetaRow icon={<IconTimeSignature />} label="Time Signature" value={song.time_signature} />
      <MetaRow icon={<IconVocal />} label="Vocal Style" value={song.vocal_style} />
      <MetaRow icon={<IconLanguage />} label="Language" value={song.vocal_language} />
      <MetaRow
        icon={<IconInstruments />}
        label="Instruments"
        value={parseInstruments(song.instruments)}
      />
      {song.style_tags && (
        <MetaRow icon={<IconStyle />} label="Style" value={song.style_tags} />
      )}
    </dl>
  );
}
