import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../hooks/useAuth.js";
import { useSongs } from "../../hooks/useSongs.js";

// ─── Types ─────────────────────────────────────────────────────────────────────

type LikeButtonProps = {
  songId: string;
  initialLiked: boolean;
  initialCount: number;
};

// ─── Component ─────────────────────────────────────────────────────────────────

export function LikeButton({ songId, initialLiked, initialCount }: LikeButtonProps) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const songs = useSongs();

  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!isAuthenticated) {
      void navigate("/login");
      return;
    }

    if (pending) return;

    // Optimistic update
    const prevLiked = liked;
    const prevCount = count;
    setLiked(!liked);
    setCount(liked ? count - 1 : count + 1);
    setPending(true);

    try {
      if (prevLiked) {
        const res = await songs.unlikeSong(songId);
        setLiked(res.liked);
        setCount(res.like_count);
      } else {
        const res = await songs.likeSong(songId);
        setLiked(res.liked);
        setCount(res.like_count);
      }
    } catch {
      // Revert on error
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      onClick={(e) => void handleClick(e)}
      disabled={pending}
      aria-label={liked ? "Unlike song" : "Like song"}
      aria-pressed={liked}
      className="inline-flex items-center gap-1 text-sm transition-colors disabled:opacity-60 cursor-pointer"
      style={{ color: liked ? "var(--color-coral)" : "#9ca3af" }}
    >
      {/* Heart icon */}
      <svg
        className="w-4 h-4 shrink-0"
        viewBox="0 0 24 24"
        fill={liked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
