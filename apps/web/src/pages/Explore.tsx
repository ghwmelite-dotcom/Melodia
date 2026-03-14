import { useState, useEffect, useRef, useCallback } from "react";
import { useSongs } from "../hooks/useSongs.js";
import { SongCard } from "../components/song/SongCard.js";
import { GenreGrid } from "../components/explore/GenreGrid.js";
import type { SongWithCreator } from "@melodia/shared";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = "new" | "popular" | "genre";

// ─── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ size = "lg" }: { size?: "sm" | "lg" }) {
  const cls = size === "sm" ? "w-5 h-5" : "w-8 h-8";
  return (
    <div className={`${cls} rounded-full border-2 border-t-transparent animate-spin`}
      style={{ borderColor: "var(--color-amber)", borderTopColor: "transparent" }}
    />
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ genre }: { genre?: string }) {
  return (
    <div className="text-center py-16">
      <p className="text-gray-400 text-sm">
        {genre
          ? `No public ${genre} songs yet. Be the first!`
          : "No public songs yet. Generate and publish one!"}
      </p>
    </div>
  );
}

// ─── Tab button ────────────────────────────────────────────────────────────────

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative px-5 py-2.5 text-sm font-medium transition-colors cursor-pointer"
      style={{ color: active ? "var(--color-amber)" : "#9ca3af" }}
    >
      {label}
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
          style={{ backgroundColor: "var(--color-amber)" }}
        />
      )}
    </button>
  );
}

// ─── Song feed ─────────────────────────────────────────────────────────────────

function SongFeed({ songs }: { songs: SongWithCreator[] }) {
  if (songs.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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

  // ── New tab: load first page ──────────────────────────────────────────────

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

  // ── Popular tab: load first page ─────────────────────────────────────────

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

  // ── Genre tab: load songs for selected genre ──────────────────────────────

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
      const res = await songs.exploreSongs({ tab: "genre", genre: selectedGenre, cursor: genreCursor });
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

  const handleSelectGenre = useCallback((genre: string) => {
    setSelectedGenre(genre);
    void loadGenreFirst(genre);
  }, [loadGenreFirst]);

  const handleBackToGenres = useCallback(() => {
    setSelectedGenre(null);
    setGenreSongs([]);
    setGenreCursor(null);
  }, []);

  // ── IntersectionObserver for infinite scroll (New + Genre) ───────────────

  useEffect(() => {
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (activeTab === "new" && newCursor && !newLoadingMore) {
          void loadNewMore();
        } else if (activeTab === "genre" && genreCursor && !genreLoadingMore && selectedGenre) {
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Explore</h1>
        <p className="text-gray-400 text-sm mt-1">Discover music from the Melodia community</p>
      </div>

      {/* Tab bar */}
      <div
        className="flex items-center border-b"
        style={{ borderColor: "var(--color-surface-3)" }}
      >
        <TabButton label="New" active={activeTab === "new"} onClick={() => setActiveTab("new")} />
        <TabButton label="Popular" active={activeTab === "popular"} onClick={() => setActiveTab("popular")} />
        <TabButton label="Genre" active={activeTab === "genre"} onClick={() => setActiveTab("genre")} />
      </div>

      {/* ── New Tab ── */}
      {activeTab === "new" && (
        <div className="space-y-4">
          {newLoading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
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
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : popularSongs.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <SongFeed songs={popularSongs} />
              {popularHasMore && (
                <div className="flex justify-center">
                  <button
                    onClick={() => void loadPopularMore()}
                    disabled={popularLoadingMore}
                    className="px-6 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
                    style={{
                      backgroundColor: "var(--color-surface-2)",
                      color: "var(--color-amber)",
                      borderColor: "var(--color-surface-3)",
                    }}
                  >
                    {popularLoadingMore ? "Loading…" : "Load More"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Genre Tab ── */}
      {activeTab === "genre" && (
        <div className="space-y-4">
          {!selectedGenre ? (
            <GenreGrid onSelectGenre={handleSelectGenre} />
          ) : (
            <>
              {/* Back + genre heading */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBackToGenres}
                  className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Back to Genres
                </button>
                <span
                  className="px-3 py-1 rounded-full text-sm font-medium capitalize"
                  style={{ backgroundColor: "var(--color-surface-2)", color: "var(--color-amber)" }}
                >
                  {selectedGenre}
                </span>
              </div>

              {genreLoading ? (
                <div className="flex justify-center py-16"><Spinner /></div>
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
