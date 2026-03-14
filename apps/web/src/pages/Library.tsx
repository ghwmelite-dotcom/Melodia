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

const STATUS_FILTERS: { id: StatusFilter; label: string; emoji: string }[] = [
  { id: "all",       label: "All",        emoji: "✦" },
  { id: "completed", label: "Completed",  emoji: "✓" },
  { id: "failed",    label: "Failed",     emoji: "✗" },
  { id: "liked",     label: "Liked",      emoji: "♥" },
];

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
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
          style={{ backgroundColor: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.12)" }}
        >
          🤍
        </div>
        <div className="text-center">
          <p className="text-white font-semibold mb-1" style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}>
            No liked songs yet
          </p>
          <p className="text-gray-500 text-sm">Explore the community and like songs you love.</p>
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

  if (filter !== "all") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <span className="text-3xl">🎵</span>
        <p className="text-gray-500 text-sm">No {filter} songs yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      {/* Decorative music art */}
      <div className="relative">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center"
          style={{
            background: "radial-gradient(circle at 40% 40%, rgba(240,165,0,0.15), rgba(240,165,0,0.03))",
            border: "1px solid rgba(240,165,0,0.12)",
            boxShadow: "0 0 40px rgba(240,165,0,0.08)",
          }}
        >
          <svg
            className="w-12 h-12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-amber)"
            strokeWidth={1.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        {/* Floating notes */}
        <span className="absolute -top-2 -right-2 text-lg opacity-50">♪</span>
        <span className="absolute -bottom-1 -left-3 text-sm opacity-30">♫</span>
      </div>

      <div className="text-center space-y-1.5">
        <h3
          className="text-xl font-bold text-white"
          style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}
        >
          No songs yet
        </h3>
        <p className="text-gray-500 text-sm max-w-xs">
          Your AI-generated songs will appear here. Create your first track now.
        </p>
      </div>

      <Link
        to="/studio"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all hover:opacity-90 active:scale-95"
        style={{
          backgroundColor: "var(--color-amber)",
          color: "var(--color-charcoal)",
          boxShadow: "0 4px 20px rgba(240,165,0,0.35)",
        }}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
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

  const setView = useCallback((v: ViewMode) => {
    setViewMode(v);
    localStorage.setItem(LS_VIEW_KEY, v);
  }, []);

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
      // Ignore
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, likedPage, loadingMore, loadingFirst, filter, songs]);

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Title + count badge */}
        <div className="flex items-center gap-3">
          <h1
            className="text-3xl font-bold text-white leading-tight"
            style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}
          >
            Your Songs
          </h1>
          {!loadingFirst && totalFetched > 0 && (
            <span
              className="px-3 py-1 rounded-full text-sm font-bold"
              style={{
                backgroundColor: "rgba(240,165,0,0.1)",
                color: "var(--color-amber)",
                border: "1px solid rgba(240,165,0,0.2)",
              }}
            >
              {totalFetched}{hasMore ? "+" : ""}
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div
            className="flex items-center rounded-xl overflow-hidden border p-0.5 gap-0.5"
            style={{
              backgroundColor: "var(--color-surface-2)",
              borderColor: "rgba(255,255,255,0.06)",
            }}
          >
            {(["grid", "list"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="p-2 rounded-lg transition-all cursor-pointer"
                style={
                  viewMode === v
                    ? {
                        backgroundColor: "var(--color-amber)",
                        color: "var(--color-charcoal)",
                        boxShadow: "0 2px 8px rgba(240,165,0,0.3)",
                      }
                    : { color: "#6b7280" }
                }
                aria-label={`${v === "grid" ? "Grid" : "List"} view`}
                aria-pressed={viewMode === v}
              >
                {v === "grid" ? (
                  <GridIcon active={viewMode === "grid"} />
                ) : (
                  <ListIcon active={viewMode === "list"} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map(({ id, label, emoji }) => {
          const active = filter === id;
          return (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer"
              style={
                active
                  ? {
                      backgroundColor: "var(--color-amber)",
                      color: "var(--color-charcoal)",
                      boxShadow: "0 2px 12px rgba(240,165,0,0.35)",
                    }
                  : {
                      backgroundColor: "var(--color-surface-2)",
                      color: "#6b7280",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }
              }
            >
              <span aria-hidden="true">{emoji}</span>
              {label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      {loadingFirst ? (
        <div className="flex items-center justify-center py-24">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--color-amber)", borderTopColor: "transparent" }}
          />
        </div>
      ) : items.length === 0 ? (
        <EmptyState filter={filter} />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((song) => (
            <SongCard key={song.id} song={song} />
          ))}
        </div>
      ) : (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{
            backgroundColor: "var(--color-surface-1)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          {items.map((song, idx) => (
            <div
              key={song.id}
              className={idx < items.length - 1 ? "border-b" : ""}
              style={{ borderColor: "rgba(255,255,255,0.04)" }}
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
              style={{ borderColor: "var(--color-amber)", borderTopColor: "transparent" }}
            />
          )}
        </div>
      )}
    </div>
  );
}
