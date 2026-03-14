import { useState, useEffect, useRef, useCallback } from "react";
import { useSongs } from "../hooks/useSongs.js";
import { SongCard } from "../components/song/SongCard.js";
import { GenreGrid } from "../components/explore/GenreGrid.js";
import type { SongWithCreator } from "@melodia/shared";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = "new" | "popular" | "genre";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "new",     label: "New",     icon: "✦" },
  { id: "popular", label: "Popular", icon: "🔥" },
  { id: "genre",   label: "Genre",   icon: "🎵" },
];

// ─── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ size = "lg" }: { size?: "sm" | "lg" }) {
  const cls = size === "sm" ? "w-5 h-5" : "w-8 h-8";
  return (
    <div
      className={`${cls} rounded-full border-2 border-t-transparent animate-spin`}
      style={{ borderColor: "var(--color-amber)", borderTopColor: "transparent" }}
    />
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ genre }: { genre?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
        style={{ backgroundColor: "rgba(240,165,0,0.08)", border: "1px solid rgba(240,165,0,0.15)" }}
      >
        🎵
      </div>
      <p className="text-gray-400 text-sm text-center max-w-xs">
        {genre
          ? `No public ${genre} songs yet. Be the first to create one!`
          : "No public songs yet. Generate and publish one!"}
      </p>
    </div>
  );
}

// ─── Pill Tab Bar ──────────────────────────────────────────────────────────────

function TabBar({
  activeTab,
  onChange,
}: {
  activeTab: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <div
      className="flex items-center gap-1 p-1 rounded-full w-fit"
      style={{
        backgroundColor: "var(--color-surface-2)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
      role="tablist"
      aria-label="Explore tabs"
    >
      {TABS.map(({ id, label, icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className="relative flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer select-none"
            style={
              active
                ? {
                    backgroundColor: "var(--color-amber)",
                    color: "var(--color-charcoal)",
                    boxShadow: "0 2px 12px rgba(240,165,0,0.4)",
                    fontFamily: "'Outfit', 'Sora', sans-serif",
                  }
                : {
                    backgroundColor: "transparent",
                    color: "#6b7280",
                    fontFamily: "'Outfit', 'Sora', sans-serif",
                  }
            }
          >
            <span className="text-base leading-none" aria-hidden="true">{icon}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Song feed ─────────────────────────────────────────────────────────────────

function SongFeed({ songs }: { songs: SongWithCreator[] }) {
  if (songs.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {songs.map((song) => (
        <SongCard
          key={song.id}
          song={song}
          creatorUsername={song.creator_username}
          likeCount={song.like_count}
          playCount={song.play_count}
          isLiked={song.is_liked ?? false}
          songId={song.id}
          showSocialStats={true}
        />
      ))}
    </div>
  );
}

// ─── Load More Button ──────────────────────────────────────────────────────────

function LoadMoreButton({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex justify-center pt-2">
      <button
        onClick={onClick}
        disabled={loading}
        className="inline-flex items-center gap-2 px-7 py-2.5 rounded-full text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer"
        style={{
          backgroundColor: "var(--color-surface-2)",
          color: "var(--color-amber)",
          border: "1px solid rgba(240,165,0,0.2)",
          transition: "background-color 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
            "rgba(240,165,0,0.08)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 0 20px rgba(240,165,0,0.15)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
            "var(--color-surface-2)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
        }}
      >
        {loading ? (
          <>
            <Spinner size="sm" />
            Loading…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            Load More
          </>
        )}
      </button>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Explore() {
  const songs = useSongs();

  const [activeTab, setActiveTab] = useState<Tab>("new");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  // New tab state
  const [newSongs, setNewSongs] = useState<SongWithCreator[]>([]);
  const [newCursor, setNewCursor] = useState<string | null>(null);
  const [newLoading, setNewLoading] = useState(false);
  const [newLoadingMore, setNewLoadingMore] = useState(false);

  // Popular tab state
  const [popularSongs, setPopularSongs] = useState<SongWithCreator[]>([]);
  const [popularPage, setPopularPage] = useState(0);
  const [popularHasMore, setPopularHasMore] = useState(true);
  const [popularLoading, setPopularLoading] = useState(false);
  const [popularLoadingMore, setPopularLoadingMore] = useState(false);

  // Genre tab state (filtered song feed)
  const [genreSongs, setGenreSongs] = useState<SongWithCreator[]>([]);
  const [genreCursor, setGenreCursor] = useState<string | null>(null);
  const [genreLoading, setGenreLoading] = useState(false);
  const [genreLoadingMore, setGenreLoadingMore] = useState(false);

  const sentinelNewRef = useRef<HTMLDivElement>(null);
  const sentinelGenreRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ── New tab ──────────────────────────────────────────────────────────────

  const loadNewFirst = useCallback(async () => {
    setNewLoading(true);
    setNewSongs([]);
    setNewCursor(null);
    try {
      const res = await songs.exploreSongs({ tab: "new" });
      setNewSongs(res.songs);
      setNewCursor(res.next_cursor);
    } catch {
      // silent
    } finally {
      setNewLoading(false);
    }
  }, [songs]);

  const loadNewMore = useCallback(async () => {
    if (!newCursor || newLoadingMore || newLoading) return;
    setNewLoadingMore(true);
    try {
      const res = await songs.exploreSongs({ tab: "new", cursor: newCursor });
      setNewSongs((prev) => [...prev, ...res.songs]);
      setNewCursor(res.next_cursor);
    } catch {
      // silent
    } finally {
      setNewLoadingMore(false);
    }
  }, [newCursor, newLoadingMore, newLoading, songs]);

  // ── Popular tab ──────────────────────────────────────────────────────────

  const loadPopularFirst = useCallback(async () => {
    setPopularLoading(true);
    setPopularSongs([]);
    setPopularPage(0);
    setPopularHasMore(true);
    try {
      const res = await songs.exploreSongs({ tab: "popular", offset: 0 });
      setPopularSongs(res.songs);
      setPopularHasMore(res.next_cursor !== null);
    } catch {
      // silent
    } finally {
      setPopularLoading(false);
    }
  }, [songs]);

  const loadPopularMore = useCallback(async () => {
    if (popularLoadingMore || !popularHasMore) return;
    setPopularLoadingMore(true);
    const nextPage = popularPage + 1;
    try {
      const res = await songs.exploreSongs({ tab: "popular", offset: nextPage * 20 });
      setPopularSongs((prev) => [...prev, ...res.songs]);
      setPopularPage(nextPage);
      setPopularHasMore(res.next_cursor !== null);
    } catch {
      // silent
    } finally {
      setPopularLoadingMore(false);
    }
  }, [popularLoadingMore, popularHasMore, popularPage, songs]);

  // ── Genre tab ────────────────────────────────────────────────────────────

  const loadGenreFirst = useCallback(async (genre: string) => {
    setGenreLoading(true);
    setGenreSongs([]);
    setGenreCursor(null);
    try {
      const res = await songs.exploreSongs({ tab: "genre", genre });
      setGenreSongs(res.songs);
      setGenreCursor(res.next_cursor);
    } catch {
      // silent
    } finally {
      setGenreLoading(false);
    }
  }, [songs]);

  const loadGenreMore = useCallback(async () => {
    if (!selectedGenre || !genreCursor || genreLoadingMore || genreLoading) return;
    setGenreLoadingMore(true);
    try {
      const res = await songs.exploreSongs({
        tab: "genre",
        genre: selectedGenre,
        cursor: genreCursor,
      });
      setGenreSongs((prev) => [...prev, ...res.songs]);
      setGenreCursor(res.next_cursor);
    } catch {
      // silent
    } finally {
      setGenreLoadingMore(false);
    }
  }, [selectedGenre, genreCursor, genreLoadingMore, genreLoading, songs]);

  // ── Tab change effects ────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab === "new") {
      void loadNewFirst();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === "popular") {
      void loadPopularFirst();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectGenre = useCallback(
    (genre: string) => {
      setSelectedGenre(genre);
      void loadGenreFirst(genre);
    },
    [loadGenreFirst]
  );

  const handleBackToGenres = useCallback(() => {
    setSelectedGenre(null);
    setGenreSongs([]);
    setGenreCursor(null);
  }, []);

  // ── IntersectionObserver ──────────────────────────────────────────────────

  useEffect(() => {
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (activeTab === "new" && newCursor && !newLoadingMore) {
          void loadNewMore();
        } else if (
          activeTab === "genre" &&
          genreCursor &&
          !genreLoadingMore &&
          selectedGenre
        ) {
          void loadGenreMore();
        }
      },
      { rootMargin: "200px" }
    );

    const sentinel =
      activeTab === "new" ? sentinelNewRef.current : sentinelGenreRef.current;
    if (sentinel) {
      observerRef.current.observe(sentinel);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [
    activeTab,
    newCursor,
    newLoadingMore,
    genreCursor,
    genreLoadingMore,
    selectedGenre,
    loadNewMore,
    loadGenreMore,
  ]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-bold text-white leading-tight"
            style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}
          >
            Explore
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Discover music from the Melodia community
          </p>
        </div>

        {/* Tab bar — pill style */}
        <TabBar activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* ── New Tab ── */}
      {activeTab === "new" && (
        <div className="space-y-5">
          {newLoading ? (
            <div className="flex justify-center py-20">
              <Spinner />
            </div>
          ) : newSongs.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <SongFeed songs={newSongs} />
              {newCursor && (
                <div ref={sentinelNewRef} className="flex justify-center py-6">
                  {newLoadingMore && <Spinner size="sm" />}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Popular Tab ── */}
      {activeTab === "popular" && (
        <div className="space-y-6">
          {popularLoading ? (
            <div className="flex justify-center py-20">
              <Spinner />
            </div>
          ) : popularSongs.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <SongFeed songs={popularSongs} />
              {popularHasMore && (
                <LoadMoreButton
                  onClick={() => void loadPopularMore()}
                  loading={popularLoadingMore}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* ── Genre Tab ── */}
      {activeTab === "genre" && (
        <div className="space-y-5">
          {!selectedGenre ? (
            <GenreGrid onSelectGenre={handleSelectGenre} />
          ) : (
            <>
              {/* Back + genre heading */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleBackToGenres}
                  className="inline-flex items-center gap-1.5 text-sm font-medium transition-all cursor-pointer rounded-full px-3 py-1.5"
                  style={{
                    color: "#6b7280",
                    backgroundColor: "var(--color-surface-2)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.color = "white")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.color = "#6b7280")
                  }
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  All Genres
                </button>

                <span
                  className="px-4 py-1.5 rounded-full text-sm font-bold capitalize"
                  style={{
                    backgroundColor: "rgba(240,165,0,0.12)",
                    color: "var(--color-amber)",
                    border: "1px solid rgba(240,165,0,0.25)",
                    fontFamily: "'Outfit', 'Sora', sans-serif",
                  }}
                >
                  {selectedGenre}
                </span>
              </div>

              {genreLoading ? (
                <div className="flex justify-center py-20">
                  <Spinner />
                </div>
              ) : genreSongs.length === 0 ? (
                <EmptyState genre={selectedGenre} />
              ) : (
                <>
                  <SongFeed songs={genreSongs} />
                  {genreCursor && (
                    <div ref={sentinelGenreRef} className="flex justify-center py-6">
                      {genreLoadingMore && <Spinner size="sm" />}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
