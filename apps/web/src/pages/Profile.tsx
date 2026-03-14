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

// Avatar gradient colors keyed by first char of username
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

    return () => { cancelled = true; };
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
      <div className="text-center py-20 space-y-4">
        <p className="text-xl font-semibold text-white">User not found</p>
        <p className="text-gray-400 text-sm">
          The profile @{username} doesn&apos;t exist or has been removed.
        </p>
        <Link
          to="/explore"
          className="inline-block px-4 py-2 rounded-xl text-sm font-medium"
          style={{ backgroundColor: "var(--color-surface-2)", color: "var(--color-amber)" }}
        >
          Explore Music
        </Link>
      </div>
    );
  }

  // ── Profile ──

  const displayName = profile.display_name ?? profile.username;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Profile header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Avatar */}
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={`${displayName} avatar`}
            className="w-20 h-20 rounded-full object-cover shrink-0"
            style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}
          />
        ) : (
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-xl select-none"
            style={{
              background: getAvatarGradient(profile.username),
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}
            aria-hidden="true"
          >
            {getInitials(profile.username)}
          </div>
        )}

        {/* Info */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-white">{displayName}</h1>
          {profile.display_name && (
            <p className="text-gray-400 text-sm">@{profile.username}</p>
          )}
          <p className="text-gray-500 text-sm">
            Joined {formatJoinDate(profile.created_at)}
            {" · "}
            <span className="text-gray-400">
              {profile.song_count} {profile.song_count === 1 ? "song" : "songs"}
            </span>
          </p>
        </div>
      </div>

      {/* Songs section */}
      <div className="space-y-4">
        <h2
          className="text-sm font-semibold text-gray-400 uppercase tracking-wider pb-2 border-b"
          style={{ borderColor: "var(--color-surface-3)" }}
        >
          Public Songs
        </h2>

        {songs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">No public songs yet.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {songs.map((song) => (
                <SongCard key={song.id} song={song} />
              ))}
            </div>

            {/* Infinite scroll sentinel */}
            {nextCursor && (
              <div ref={sentinelRef} className="flex justify-center py-6">
                {loadingMore && (
                  <div
                    className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "var(--color-amber)", borderTopColor: "transparent" }}
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
