import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router";
import { useSongs } from "../hooks/useSongs.js";
import { SongCard } from "../components/song/SongCard.js";
import { SongRow } from "../components/song/SongRow.js";
import type { Song } from "@melodia/shared";

// ─── Constants ─────────────────────────────────────────────────────────────────

type ViewMode = "grid" | "list";
type StatusFilter = "all" | "completed" | "failed" | "liked";

const LS_VIEW_KEY = "melodia-library-view";

// ─── Icons ─────────────────────────────────────────────────────────────────────

function GridIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ListIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2 : 1.5}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: StatusFilter }) {
  if (filter === "liked") {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-gray-400 text-sm">No liked songs yet.</p>
        <Link
          to="/explore"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ backgroundColor: "var(--color-surface-2)", color: "var(--color-amber)" }}
        >
          Explore Music
        </Link>
      </div>
    );
  }

  if (filter !== "all") {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-sm">
          No {filter} songs yet.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-20 space-y-4">
      {/* Music note icon */}
      <div
        className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-2"
        style={{ backgroundColor: "rgba(240,165,0,0.1)" }}
      >
        <svg
          className="w-8 h-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-amber)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-white">No songs yet</h3>
      <p className="text-gray-400 text-sm">Create your first AI-generated song.</p>
      <Link
        to="/studio"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        style={{ backgroundColor: "var(--color-amber)", color: "var(--color-charcoal)" }}
      >
        Create your first song
      </Link>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Library() {
  const songs = useSongs();

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(LS_VIEW_KEY);
    return saved === "list" ? "list" : "grid";
  });
  const [filter, setFilter] = useState<StatusFilter>("all");

  const [items, setItems] = useState<Song[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [likedPage, setLikedPage] = useState(0);
  const [likedHasMore, setLikedHasMore] = useState(false);
  const [loadingFirst, setLoadingFirst] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalFetched, setTotalFetched] = useState(0);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Persist view mode
  const setView = useCallback((v: ViewMode) => {
    setViewMode(v);
    localStorage.setItem(LS_VIEW_KEY, v);
  }, []);

  // Load first page whenever filter changes
  const loadFirst = useCallback(async () => {
    setLoadingFirst(true);
    setItems([]);
    setNextCursor(null);
    setLikedPage(0);
    setLikedHasMore(false);
    setTotalFetched(0);

    try {
      if (filter === "liked") {
        const res = await songs.likedSongs({ page: 0 });
        setItems(res.songs);
        // likedSongs uses offset, simulate cursor via next_cursor
        setLikedHasMore(res.next_cursor !== null);
        setTotalFetched(res.songs.length);
      } else {
        const opts = filter !== "all" ? { status: filter } : undefined;
        const res = await songs.listSongs(opts);
        setItems(res.songs);
        setNextCursor(res.next_cursor);
        setTotalFetched(res.songs.length);
      }
    } catch {
      // Silently fail — show empty state
    } finally {
      setLoadingFirst(false);
    }
  }, [filter, songs]);

  useEffect(() => {
    void loadFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // Load next page
  const loadMore = useCallback(async () => {
    if (loadingMore || loadingFirst) return;

    setLoadingMore(true);
    try {
      if (filter === "liked") {
        const nextPage = likedPage + 1;
        const res = await songs.likedSongs({ page: nextPage });
        setItems((prev) => [...prev, ...res.songs]);
        setLikedPage(nextPage);
        setLikedHasMore(res.next_cursor !== null);
        setTotalFetched((n) => n + res.songs.length);
      } else {
        if (!nextCursor) return;
        const opts: { status?: string; cursor: string } = { cursor: nextCursor };
        if (filter !== "all") opts.status = filter;
        const res = await songs.listSongs(opts);
        setItems((prev) => [...prev, ...res.songs]);
        setNextCursor(res.next_cursor);
        setTotalFetched((n) => n + res.songs.length);
      }
    } catch {
      // Ignore — user can scroll again
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, likedPage, loadingMore, loadingFirst, filter, songs]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const hasMore = filter === "liked" ? likedHasMore : !!nextCursor;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
          void loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [nextCursor, likedHasMore, filter, loadingMore, loadMore]);

  const hasMore = filter === "liked" ? likedHasMore : !!nextCursor;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-bold text-white">Your Songs</h1>
          {!loadingFirst && (
            <span className="text-gray-500 text-sm">
              ({totalFetched}{hasMore ? "+" : ""})
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Status filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as StatusFilter)}
            className="rounded-xl px-3 py-2 text-sm text-white border appearance-none cursor-pointer focus:outline-none focus:ring-2"
            style={{
              backgroundColor: "var(--color-surface-2)",
              borderColor: "var(--color-surface-3)",
              // @ts-expect-error CSS custom prop
              "--tw-ring-color": "var(--color-amber)",
            }}
          >
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="liked">Liked</option>
          </select>

          {/* View toggle */}
          <div
            className="flex items-center rounded-xl overflow-hidden border"
            style={{ borderColor: "var(--color-surface-3)" }}
          >
            <button
              onClick={() => setView("grid")}
              className={`p-2 transition-colors ${viewMode === "grid" ? "text-amber" : "text-gray-500 hover:text-gray-300"}`}
              style={{
                backgroundColor:
                  viewMode === "grid"
                    ? "var(--color-surface-3)"
                    : "var(--color-surface-2)",
              }}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
            >
              <GridIcon active={viewMode === "grid"} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-2 transition-colors ${viewMode === "list" ? "text-amber" : "text-gray-500 hover:text-gray-300"}`}
              style={{
                backgroundColor:
                  viewMode === "list"
                    ? "var(--color-surface-3)"
                    : "var(--color-surface-2)",
              }}
              aria-label="List view"
              aria-pressed={viewMode === "list"}
            >
              <ListIcon active={viewMode === "list"} />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      {loadingFirst ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{
              borderColor: "var(--color-amber)",
              borderTopColor: "transparent",
            }}
          />
        </div>
      ) : items.length === 0 ? (
        <EmptyState filter={filter} />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((song) => (
            <SongCard key={song.id} song={song} />
          ))}
        </div>
      ) : (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{
            backgroundColor: "var(--color-surface-1)",
            borderColor: "var(--color-surface-3)",
          }}
        >
          {items.map((song, idx) => (
            <div
              key={song.id}
              className={idx < items.length - 1 ? "border-b" : ""}
              style={{ borderColor: "var(--color-surface-3)" }}
            >
              <SongRow song={song} />
            </div>
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center py-6">
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
    </div>
  );
}
