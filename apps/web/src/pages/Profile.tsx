import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router";
import { useSongs } from "../hooks/useSongs.js";
import { SongCard } from "../components/song/SongCard.js";
import type { Song, UserProfile } from "@melodia/shared";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatJoinDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

const AVATAR_GRADIENTS: [string, string][] = [
  ["#F0A500", "#b45309"],
  ["#9333ea", "#db2777"],
  ["#16a34a", "#0d9488"],
  ["#2563eb", "#7c3aed"],
  ["#0d9488", "#2563eb"],
  ["#db2777", "#9333ea"],
  ["#d97706", "#92400e"],
  ["#1d4ed8", "#3730a3"],
];

function getAvatarGradient(username: string): string {
  const idx = username.charCodeAt(0) % AVATAR_GRADIENTS.length;
  const [a, b] = AVATAR_GRADIENTS[idx]!;
  return `linear-gradient(135deg, ${a}, ${b})`;
}

// Banner gradient derived from avatar gradient (slightly shifted)
function getBannerGradient(username: string): string {
  const idx = username.charCodeAt(0) % AVATAR_GRADIENTS.length;
  const [a, b] = AVATAR_GRADIENTS[idx]!;
  return `linear-gradient(135deg, ${a}22 0%, ${b}18 50%, transparent 100%)`;
}

// ─── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div
        className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: "var(--color-amber)", borderTopColor: "transparent" }}
      />
    </div>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center gap-0.5 px-5 py-3 rounded-2xl"
      style={{
        backgroundColor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        minWidth: "88px",
      }}
    >
      <span className="text-gray-500 flex items-center gap-1 text-xs">{icon} {label}</span>
      <span
        className="text-white font-bold text-lg leading-tight"
        style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const songsHook = useSongs();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<"loading" | "loaded" | "not_found">("loading");
  const [loadingMore, setLoadingMore] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Load profile + first page of songs
  useEffect(() => {
    if (!username) return;

    let cancelled = false;
    setLoadingState("loading");
    setProfile(null);
    setSongs([]);
    setNextCursor(null);

    void (async () => {
      try {
        const [profileData, songsData] = await Promise.all([
          songsHook.getProfile(username),
          songsHook.getProfileSongs(username),
        ]);
        if (cancelled) return;
        setProfile(profileData);
        setSongs(songsData.songs);
        setNextCursor(songsData.next_cursor);
        setLoadingState("loaded");
      } catch {
        if (!cancelled) setLoadingState("not_found");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // Load more songs
  const loadMore = useCallback(async () => {
    if (!username || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await songsHook.getProfileSongs(username, { cursor: nextCursor });
      setSongs((prev) => [...prev, ...res.songs]);
      setNextCursor(res.next_cursor);
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  }, [username, nextCursor, loadingMore, songsHook]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextCursor && !loadingMore) {
          void loadMore();
        }
      },
      { rootMargin: "200px" }
    );
    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }
    return () => observerRef.current?.disconnect();
  }, [nextCursor, loadingMore, loadMore]);

  // ── Loading ──

  if (loadingState === "loading") {
    return <Spinner />;
  }

  // ── Not Found ──

  if (loadingState === "not_found" || !profile) {
    return (
      <div className="text-center py-24 space-y-5">
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-3xl text-4xl mx-auto"
          style={{ backgroundColor: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.15)" }}
        >
          🔍
        </div>
        <div>
          <p className="text-xl font-bold text-white" style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}>
            Profile not found
          </p>
          <p className="text-gray-500 text-sm mt-1">
            @{username} doesn&apos;t exist or has been removed.
          </p>
        </div>
        <Link
          to="/explore"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: "var(--color-amber)", color: "var(--color-charcoal)" }}
        >
          Explore Music
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      </div>
    );
  }

  // ── Profile ──

  const displayName = profile.display_name ?? profile.username;

  return (
    <div className="space-y-0 max-w-5xl mx-auto">
      {/* ── Hero banner ── */}
      <div
        className="relative rounded-3xl overflow-hidden mb-0"
        style={{
          background: getBannerGradient(profile.username),
          border: "1px solid rgba(255,255,255,0.06)",
          minHeight: "160px",
        }}
      >
        {/* Decorative orbs */}
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-10 blur-2xl"
          style={{ background: getAvatarGradient(profile.username) }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full opacity-8 blur-xl"
          style={{ background: getAvatarGradient(profile.username) }}
        />

        {/* Profile content inside banner */}
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-end gap-5 p-6 sm:p-8 pb-7">
          {/* Avatar with amber ring */}
          <div className="relative flex-shrink-0">
            <div
              className="p-0.5 rounded-full"
              style={{
                background: "linear-gradient(135deg, var(--color-amber), rgba(240,165,0,0.3))",
                boxShadow: "0 0 0 3px rgba(240,165,0,0.15), 0 8px 32px rgba(0,0,0,0.4)",
              }}
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={`${displayName} avatar`}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-xl select-none"
                  style={{ background: getAvatarGradient(profile.username) }}
                  aria-hidden="true"
                >
                  {getInitials(profile.username)}
                </div>
              )}
            </div>
          </div>

          {/* Name + meta */}
          <div className="flex-1 space-y-1">
            <h1
              className="text-2xl sm:text-3xl font-bold text-white leading-tight"
              style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}
            >
              {displayName}
            </h1>
            {profile.display_name && (
              <p className="text-gray-400 text-sm font-medium">@{profile.username}</p>
            )}
            <p className="text-gray-600 text-xs">
              Member since {formatJoinDate(profile.created_at)}
            </p>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatChip
              label="Songs"
              value={profile.song_count}
              icon={
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              }
            />
          </div>
        </div>
      </div>

      {/* ── Songs grid ── */}
      <div className="space-y-5 pt-7">
        <div className="flex items-center gap-3">
          <h2
            className="text-base font-bold text-white"
            style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}
          >
            Public Songs
          </h2>
          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{
              backgroundColor: "rgba(240,165,0,0.1)",
              color: "var(--color-amber)",
              border: "1px solid rgba(240,165,0,0.2)",
            }}
          >
            {songs.length}
            {nextCursor ? "+" : ""}
          </span>
        </div>

        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-4xl">🎵</span>
            <p className="text-gray-500 text-sm">No public songs yet.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {songs.map((song) => (
                <SongCard key={song.id} song={song} />
              ))}
            </div>

            {nextCursor && (
              <div ref={sentinelRef} className="flex justify-center py-6">
                {loadingMore && (
                  <div
                    className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                    style={{
                      borderColor: "var(--color-amber)",
                      borderTopColor: "transparent",
                    }}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
