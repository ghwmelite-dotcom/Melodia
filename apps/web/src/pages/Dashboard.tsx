import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router";
import { useAuth } from "../hooks/useAuth.js";
import { useApi } from "../hooks/useApi.js";
import { useSongs } from "../hooks/useSongs.js";
import { SongCard } from "../components/song/SongCard.js";
import type { Song } from "@melodia/shared";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Cycling placeholder ──────────────────────────────────────────────────────

const PROMPTS = [
  "Afrobeats love song about Lagos sunsets…",
  "Gospel worship anthem with choir…",
  "Amapiano banger for the dance floor…",
  "Highlife track about homecoming…",
  "Trap banger about resilience…",
  "Afro-soul midnight ballad…",
  "Dancehall riddim with West African flair…",
];

function useCyclingPlaceholder(active: boolean): string {
  const [idx, setIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [charIdx, setCharIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;

    const target = PROMPTS[idx] ?? "";

    if (charIdx < target.length) {
      timerRef.current = setTimeout(() => {
        setDisplayed(target.slice(0, charIdx + 1));
        setCharIdx((c) => c + 1);
      }, 38);
    } else {
      timerRef.current = setTimeout(() => {
        setDisplayed("");
        setCharIdx(0);
        setIdx((i) => (i + 1) % PROMPTS.length);
      }, 2400);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, idx, charIdx]);

  return displayed;
}

// ─── Credits progress ring ────────────────────────────────────────────────────

function CreditsRing({
  remaining,
  total,
}: {
  remaining: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, (remaining / total) * 100) : 0;
  const size = 64;
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(45,45,80,0.8)"
          strokeWidth="5"
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#F0A500"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)" }}
          filter="url(#amberGlow)"
        />
        <defs>
          <filter id="amberGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          lineHeight: 1,
        }}
      >
        <span
          style={{
            fontSize: "15px",
            fontWeight: 800,
            color: "#F0A500",
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          {remaining}
        </span>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  children,
  gradient,
}: {
  children: React.ReactNode;
  gradient?: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: "20px",
        padding: "22px 24px",
        border: "1px solid rgba(255,255,255,0.07)",
        background: gradient ?? "rgba(22, 22, 42, 0.7)",
        backdropFilter: "blur(12px)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hovered
          ? "0 16px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(240,165,0,0.1)"
          : "0 4px 20px rgba(0,0,0,0.25)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle inner shine */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
          pointerEvents: "none",
        }}
      />
      {children}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const songs = useSongs();
  const { call, loading: generating } = useApi<{ song_id: string }>();

  const [quickPrompt, setQuickPrompt] = useState("");
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [recentSongs, setRecentSongs] = useState<Song[]>([]);
  const [inputFocused, setInputFocused] = useState(false);

  const placeholder = useCyclingPlaceholder(!inputFocused && quickPrompt === "");

  // Load recent songs on mount
  useEffect(() => {
    songs
      .listSongs({ limit: 6 })
      .then((res) => setRecentSongs(res.songs))
      .catch(() => {
        // Non-critical — silently fail
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quick generate handler
  const handleQuickGenerate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!quickPrompt.trim()) return;
      setGenerateError(null);

      const result = await call(() =>
        songs.generate({ prompt: quickPrompt.trim() })
      );

      if (result) {
        void navigate(`/studio/song/${result.song_id}`);
      } else {
        setGenerateError(
          "Failed to start generation. Check your credits and try again."
        );
      }
    },
    [call, songs, quickPrompt, navigate]
  );

  const planColors: Record<string, { bg: string; text: string; border: string }> = {
    free: {
      bg: "rgba(45, 45, 80, 0.5)",
      text: "#9ca3af",
      border: "rgba(100,100,140,0.4)",
    },
    creator: {
      bg: "rgba(240, 165, 0, 0.1)",
      text: "#FFD060",
      border: "rgba(240, 165, 0, 0.25)",
    },
    pro: {
      bg: "rgba(240, 165, 0, 0.15)",
      text: "#F0A500",
      border: "rgba(240, 165, 0, 0.35)",
    },
    enterprise: {
      bg: "rgba(0, 210, 255, 0.12)",
      text: "var(--color-teal)",
      border: "rgba(0, 210, 255, 0.35)",
    },
  };

  const planStyle = planColors[user?.plan ?? "free"] ?? {
    bg: "rgba(45, 45, 80, 0.5)",
    text: "#9ca3af",
    border: "rgba(100,100,140,0.4)",
  };

  const creditsTotal =
    user?.plan === "enterprise"
      ? 500
      : user?.plan === "pro"
      ? 100
      : user?.plan === "creator"
      ? 50
      : 5;
  const creditsRemaining = user?.credits_remaining ?? 0;

  const displayName = user?.display_name ?? user?.username ?? "Musician";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>

      {/* ── Welcome section ── */}
      <div
        style={{
          borderRadius: "24px",
          padding: "36px 40px",
          background:
            "linear-gradient(135deg, rgba(240,165,0,0.07) 0%, rgba(22,22,42,0.0) 50%, rgba(255,107,107,0.05) 100%)",
          border: "1px solid rgba(240,165,0,0.1)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient mesh blobs */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "-60px",
            right: "-60px",
            width: "240px",
            height: "240px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(240,165,0,0.10) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: "-40px",
            left: "30%",
            width: "160px",
            height: "160px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,107,107,0.07) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <p
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "rgba(240,165,0,0.75)",
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}
        >
          {getGreeting()}
        </p>
        <h1
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: "clamp(26px, 4vw, 36px)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            margin: 0,
            color: "#ffffff",
          }}
        >
          Welcome back,{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #F0A500 0%, #FFD060 60%, #FF8C00 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {displayName}
          </span>
        </h1>
        <p
          style={{
            marginTop: "8px",
            fontSize: "15px",
            color: "rgba(156,163,175,0.9)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Your AI music studio — let&apos;s create something extraordinary.
        </p>
      </div>

      {/* ── Quick generate command bar ── */}
      <div
        style={{
          borderRadius: "20px",
          padding: "6px",
          border: "1px solid rgba(240,165,0,0.2)",
          background: "rgba(22, 22, 42, 0.8)",
          backdropFilter: "blur(12px)",
          boxShadow: inputFocused
            ? "0 0 0 1px rgba(240,165,0,0.35), 0 8px 40px rgba(240,165,0,0.12), 0 4px 24px rgba(0,0,0,0.3)"
            : "0 4px 24px rgba(0,0,0,0.25)",
          transition: "box-shadow 0.25s ease",
        }}
      >
        <form
          onSubmit={(e) => void handleQuickGenerate(e)}
          style={{ display: "flex", gap: "6px", alignItems: "center" }}
        >
          {/* Music note icon inside input */}
          <div
            style={{
              paddingLeft: "16px",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              color: inputFocused ? "#F0A500" : "rgba(156,163,175,0.5)",
              transition: "color 0.2s",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>

          <input
            type="text"
            value={quickPrompt}
            onChange={(e) => setQuickPrompt(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={placeholder || "Describe the music you want to create…"}
            style={{
              flex: 1,
              minWidth: 0,
              background: "none",
              border: "none",
              outline: "none",
              padding: "16px 12px",
              fontSize: "15px",
              color: "#ffffff",
              fontFamily: "'DM Sans', sans-serif",
              caretColor: "#F0A500",
            }}
          />

          <button
            type="submit"
            disabled={generating || !quickPrompt.trim()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 22px",
              borderRadius: "14px",
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 700,
              fontSize: "14px",
              letterSpacing: "0.01em",
              background: generating || !quickPrompt.trim()
                ? "rgba(240,165,0,0.35)"
                : "linear-gradient(135deg, #F0A500 0%, #FF8C00 100%)",
              color: "#0D0D1A",
              border: "none",
              cursor: generating || !quickPrompt.trim() ? "not-allowed" : "pointer",
              transition: "background 0.2s, box-shadow 0.2s, transform 0.15s",
              boxShadow:
                generating || !quickPrompt.trim()
                  ? "none"
                  : "0 4px 16px rgba(240,165,0,0.4)",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!generating && quickPrompt.trim()) {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 6px 24px rgba(240,165,0,0.55)";
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 4px 16px rgba(240,165,0,0.4)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
            }}
          >
            {generating ? (
              <svg
                style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            )}
            {generating ? "Generating…" : "Generate"}
          </button>
        </form>

        {generateError && (
          <p
            style={{
              padding: "8px 16px 10px",
              fontSize: "13px",
              color: "var(--color-coral)",
              fontFamily: "'DM Sans', sans-serif",
              margin: 0,
            }}
          >
            {generateError}
          </p>
        )}
      </div>

      {/* Spin keyframe injected once */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ── Stats row ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Credits card */}
        <StatCard gradient="linear-gradient(135deg, rgba(240,165,0,0.1) 0%, rgba(22,22,42,0.9) 100%)">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "rgba(156,163,175,0.7)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  margin: 0,
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                Credits
              </p>
              <p
                style={{
                  fontSize: "36px",
                  fontWeight: 800,
                  color: "#F0A500",
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.1,
                  margin: "6px 0 2px",
                }}
              >
                {creditsRemaining}
              </p>
              <p
                style={{
                  fontSize: "12px",
                  color: "rgba(156,163,175,0.6)",
                  fontFamily: "'DM Sans', sans-serif",
                  margin: 0,
                }}
              >
                of {creditsTotal} remaining
              </p>
            </div>
            <CreditsRing remaining={creditsRemaining} total={creditsTotal} />
          </div>
        </StatCard>

        {/* Plan card */}
        <StatCard gradient="linear-gradient(135deg, rgba(30,30,55,0.9) 0%, rgba(22,22,42,0.7) 100%)">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              background: "rgba(240,165,0,0.1)",
              marginBottom: "14px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                stroke="#F0A500"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "rgba(156,163,175,0.7)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: "0 0 8px",
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Current Plan
          </p>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "5px 14px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: 700,
              fontFamily: "'Outfit', sans-serif",
              textTransform: "capitalize",
              letterSpacing: "0.02em",
              backgroundColor: planStyle.bg,
              color: planStyle.text,
              border: `1px solid ${planStyle.border}`,
            }}
          >
            {user?.plan ?? "free"}
          </span>
          {(user?.plan === "free" || !user?.plan) && (
            <div style={{ marginTop: "12px" }}>
              <Link
                to="/pricing"
                style={{
                  fontSize: "12px",
                  color: "#F0A500",
                  fontFamily: "'DM Sans', sans-serif",
                  textDecoration: "none",
                  opacity: 0.85,
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.opacity = "0.85";
                }}
              >
                Upgrade to Pro →
              </Link>
            </div>
          )}
        </StatCard>

        {/* Member since */}
        <StatCard gradient="linear-gradient(135deg, rgba(30,30,55,0.9) 0%, rgba(22,22,42,0.7) 100%)">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              background: "rgba(0,210,255,0.08)",
              marginBottom: "14px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="3" stroke="var(--color-teal)" strokeWidth="1.8" />
              <path d="M3 9h18" stroke="var(--color-teal)" strokeWidth="1.8" />
              <path d="M8 2v4M16 2v4" stroke="var(--color-teal)" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "rgba(156,163,175,0.7)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: "0 0 8px",
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Member Since
          </p>
          <p
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "#ffffff",
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {user?.created_at
              ? new Date(user.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })
              : "—"}
          </p>
        </StatCard>
      </div>

      {/* ── Recent songs ── */}
      {recentSongs.length > 0 ? (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "#ffffff",
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              Recent Songs
            </h2>
            <Link
              to="/library"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#F0A500",
                fontFamily: "'Outfit', 'DM Sans', sans-serif",
                textDecoration: "none",
                opacity: 0.8,
                transition: "opacity 0.15s",
                letterSpacing: "0.01em",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.opacity = "0.8";
              }}
            >
              View All →
            </Link>
          </div>

          <div
            style={{
              overflowX: "auto",
              marginLeft: "-4px",
              paddingLeft: "4px",
              paddingBottom: "8px",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            <style>{`.recent-songs-scroll::-webkit-scrollbar { display: none; }`}</style>
            <div
              className="recent-songs-scroll"
              style={{
                display: "flex",
                gap: "16px",
                scrollSnapType: "x mandatory",
                width: "max-content",
              }}
            >
              {recentSongs.map((song) => (
                <div
                  key={song.id}
                  style={{
                    scrollSnapAlign: "start",
                    flexShrink: 0,
                    width: "172px",
                  }}
                >
                  <SongCard song={song} compact />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Empty state */
        <div
          style={{
            borderRadius: "20px",
            padding: "28px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            background: "rgba(22, 22, 42, 0.7)",
            border: "1px solid rgba(255,255,255,0.07)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: "rgba(240,165,0,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
                  fill="#F0A500"
                  opacity="0.7"
                />
              </svg>
            </div>
            <div>
              <p
                style={{
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "15px",
                  fontFamily: "'Outfit', sans-serif",
                  margin: 0,
                }}
              >
                No songs yet
              </p>
              <p
                style={{
                  color: "rgba(156,163,175,0.8)",
                  fontSize: "13px",
                  marginTop: "3px",
                  fontFamily: "'DM Sans', sans-serif",
                  margin: "3px 0 0",
                }}
              >
                Create your first AI-generated song above or in Studio.
              </p>
            </div>
          </div>
          <Link
            to="/studio"
            style={{
              flexShrink: 0,
              padding: "10px 20px",
              borderRadius: "12px",
              fontSize: "14px",
              fontWeight: 700,
              fontFamily: "'Outfit', sans-serif",
              background: "linear-gradient(135deg, #F0A500 0%, #FF8C00 100%)",
              color: "#0D0D1A",
              textDecoration: "none",
              boxShadow: "0 4px 16px rgba(240,165,0,0.3)",
              transition: "box-shadow 0.2s, transform 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                "0 6px 24px rgba(240,165,0,0.5)";
              (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                "0 4px 16px rgba(240,165,0,0.3)";
              (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
            }}
          >
            Open Studio
          </Link>
        </div>
      )}
    </div>
  );
}
