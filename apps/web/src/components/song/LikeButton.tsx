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

// ─── Heart burst keyframes (injected once) ────────────────────────────────────

const HEART_STYLE = `
@keyframes heartPop {
  0%   { transform: scale(1); }
  20%  { transform: scale(1.45); }
  40%  { transform: scale(0.9); }
  65%  { transform: scale(1.15); }
  100% { transform: scale(1); }
}
@keyframes heartBurst {
  0%   { opacity: 1; transform: scale(0) translate(-50%, -50%); }
  60%  { opacity: 0.8; transform: scale(1.6) translate(-50%, -50%); }
  100% { opacity: 0; transform: scale(2.4) translate(-50%, -50%); }
}
.heart-pop {
  animation: heartPop 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards;
}
.heart-burst::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,107,107,0.5) 0%, transparent 70%);
  transform-origin: center;
  animation: heartBurst 0.45s ease-out forwards;
  pointer-events: none;
}
`;

let styleInjected = false;
function injectHeartStyle() {
  if (styleInjected || typeof document === "undefined") return;
  styleInjected = true;
  const el = document.createElement("style");
  el.textContent = HEART_STYLE;
  document.head.appendChild(el);
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function LikeButton({ songId, initialLiked, initialCount }: LikeButtonProps) {
  injectHeartStyle();

  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const songs = useSongs();

  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const [animating, setAnimating] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!isAuthenticated) {
      void navigate("/login");
      return;
    }

    if (pending) return;

    const prevLiked = liked;
    const prevCount = count;

    // Optimistic update + animation
    setLiked(!liked);
    setCount(liked ? count - 1 : count + 1);
    setPending(true);

    if (!liked) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 500);
    }

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
      className="inline-flex items-center gap-1.5 text-xs transition-all disabled:opacity-60 cursor-pointer select-none"
      style={{
        color: liked ? "var(--color-coral)" : "#6b7280",
        transition: "color 0.2s ease",
      }}
    >
      {/* Heart icon with pop animation */}
      <span
        className={`relative flex-shrink-0 ${animating ? "heart-pop heart-burst" : ""}`}
        style={{ display: "inline-flex", position: "relative" }}
      >
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill={liked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{
            filter: liked ? "drop-shadow(0 0 3px rgba(255,107,107,0.5))" : "none",
            transition: "filter 0.2s ease",
          }}
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </span>
      {/* Count with subtle transition */}
      <span
        className="tabular-nums font-medium"
        style={{
          transition: "all 0.2s ease",
          minWidth: "1.2ch",
          display: "inline-block",
        }}
      >
        {count}
      </span>
    </button>
  );
}
