import { useEffect, useRef, useCallback } from "react";
import { useWebSocket, type StageUpdate } from "../../hooks/useWebSocket.js";
import { api } from "../../lib/api.js";

// ─── Types ─────────────────────────────────────────────────────────────────────

type GenerationProgressProps = {
  songId: string;
  onComplete?: () => void;
};

// ─── Stage definitions ─────────────────────────────────────────────────────────

const BASE_STAGES = [
  { key: "blueprint", label: "Creating Blueprint", symbol: "🗺️" },
  { key: "lyrics", label: "Writing Lyrics", symbol: "✍️" },
  { key: "refinement", label: "Refining Lyrics", symbol: "✨" },
  { key: "music", label: "Generating Music", symbol: "🎵" },
  { key: "artwork", label: "Creating Artwork", symbol: "🎨" },
  { key: "processing", label: "Finalizing", symbol: "⚙️" },
  { key: "completed", label: "Complete", symbol: "🎉" },
] as const;

const REFERENCE_STAGE = { key: "reference", label: "Analyzing Reference", symbol: "🎵" } as const;

// Legacy constant kept for type derivation
const STAGES = BASE_STAGES;

type StageKey = (typeof BASE_STAGES)[number]["key"] | "reference";

type StageDisplayStatus = "pending" | "in_progress" | "completed" | "failed";

// ─── DB Status → Stage mapping for polling fallback ────────────────────────────

type SongPollStatus =
  | "pending"
  | "generating_lyrics"
  | "generating_music"
  | "generating_artwork"
  | "processing"
  | "completed"
  | "failed";

interface StatusPollResponse {
  success: boolean;
  status: SongPollStatus;
  error?: string;
}

function dbStatusToStages(status: SongPollStatus): {
  completed: StageKey[];
  inProgress: StageKey | null;
  failed: boolean;
} {
  switch (status) {
    case "pending":
      return { completed: [], inProgress: "blueprint", failed: false };
    case "generating_lyrics":
      return { completed: ["blueprint"], inProgress: "lyrics", failed: false };
    case "generating_music":
      return {
        completed: ["blueprint", "lyrics", "refinement"],
        inProgress: "music",
        failed: false,
      };
    case "generating_artwork":
      return {
        completed: ["blueprint", "lyrics", "refinement", "music"],
        inProgress: "artwork",
        failed: false,
      };
    case "processing":
      return {
        completed: ["blueprint", "lyrics", "refinement", "music", "artwork"],
        inProgress: "processing",
        failed: false,
      };
    case "completed":
      return {
        completed: ["blueprint", "lyrics", "refinement", "music", "artwork", "processing", "completed"],
        inProgress: null,
        failed: false,
      };
    case "failed":
      return { completed: [], inProgress: null, failed: true };
    default:
      return { completed: [], inProgress: null, failed: false };
  }
}

// ─── Stage Icon ─────────────────────────────────────────────────────────────────

function StageIcon({
  displayStatus,
  symbol,
  index,
}: {
  displayStatus: StageDisplayStatus;
  symbol: string;
  index: number;
}) {
  if (displayStatus === "completed") {
    return (
      <div
        className="relative flex items-center justify-center w-9 h-9 rounded-full shrink-0"
        style={{
          background: "linear-gradient(135deg, rgba(0,210,255,0.2) 0%, rgba(0,210,255,0.1) 100%)",
          border: "1px solid rgba(0,210,255,0.35)",
        }}
      >
        {/* Draw-in checkmark via SVG stroke animation */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4"
          style={{ color: "var(--color-teal)" }}
          aria-hidden="true"
        >
          <path
            d="M20 6L9 17l-5-5"
            style={{
              strokeDasharray: 28,
              strokeDashoffset: 0,
              animation: `drawCheck 0.4s ease-out ${index * 0.05}s both`,
            }}
          />
        </svg>
      </div>
    );
  }

  if (displayStatus === "in_progress") {
    return (
      <div className="relative flex items-center justify-center w-9 h-9 shrink-0" aria-hidden="true">
        {/* Expanding ring effect */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "rgba(240,165,0,0.15)",
            border: "1px solid rgba(240,165,0,0.4)",
            animation: "pulse-ring 1.8s ease-out infinite",
          }}
        />
        <div
          className="absolute inset-0 rounded-full scale-110 opacity-0"
          style={{
            border: "1px solid rgba(240,165,0,0.2)",
            animation: "pulse-ring 1.8s ease-out 0.6s infinite",
          }}
        />
        {/* Center icon */}
        <div
          className="relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-base"
          style={{
            background: "linear-gradient(135deg, rgba(240,165,0,0.25) 0%, rgba(240,165,0,0.1) 100%)",
            border: "1px solid rgba(240,165,0,0.5)",
          }}
        >
          {symbol}
        </div>
      </div>
    );
  }

  if (displayStatus === "failed") {
    return (
      <div
        className="flex items-center justify-center w-9 h-9 rounded-full shrink-0"
        style={{
          background: "rgba(231,76,60,0.12)",
          border: "1px solid rgba(231,76,60,0.3)",
          color: "var(--color-coral)",
          fontSize: "1rem",
        }}
        aria-hidden="true"
      >
        ✗
      </div>
    );
  }

  // pending
  return (
    <div
      className="flex items-center justify-center w-9 h-9 rounded-full shrink-0 text-base"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        opacity: 0.4,
      }}
      aria-hidden="true"
    >
      {symbol}
    </div>
  );
}

// ─── Derive stage status from WS stages array ───────────────────────────────────

function resolveStageStatuses(
  wsStages: StageUpdate[],
  isFailed: boolean
): Record<string, StageDisplayStatus> {
  const result: Record<string, StageDisplayStatus> = {};

  for (const stage of wsStages) {
    if (stage.status === "completed") {
      result[stage.stage] = "completed";
    } else if (stage.status === "in_progress") {
      result[stage.stage] = "in_progress";
    } else if (stage.status === "failed") {
      result[stage.stage] = "failed";
    }
  }

  if (isFailed) {
    for (const key of Object.keys(result)) {
      if (result[key] === "in_progress") {
        result[key] = "failed";
      }
    }
  }

  return result;
}

// ─── Background gradient that shifts warmer as progress increases ──────────────

function progressGradient(completedCount: number, totalCount: number): string {
  const ratio = completedCount / Math.max(totalCount, 1);
  // Shifts from cool blue-purple → warm amber-gold as stages complete
  const amberStop = Math.round(ratio * 12);
  return `radial-gradient(ellipse at 50% -10%, rgba(240,165,0,0.${amberStop.toString().padStart(2, "0")}) 0%, transparent 65%)`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function GenerationProgress({ songId, onComplete }: GenerationProgressProps) {
  const { connectionStatus, stages, isComplete, isFailed, error } = useWebSocket(songId);

  const completedCalledRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const pollStagesRef = useRef<{ completed: StageKey[]; inProgress: StageKey | null; failed: boolean } | null>(null);

  useEffect(() => {
    if (isComplete && !completedCalledRef.current) {
      completedCalledRef.current = true;
      onComplete?.();
    }
  }, [isComplete, onComplete]);

  const doPoll = useCallback(async () => {
    if (!isMountedRef.current) return;
    try {
      const res = await api.get<StatusPollResponse>(`/api/songs/${songId}/status`);
      if (!isMountedRef.current) return;

      pollStagesRef.current = dbStatusToStages(res.status);

      if (res.status === "completed" && !completedCalledRef.current) {
        completedCalledRef.current = true;
        onComplete?.();
        if (pollIntervalRef.current !== null) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    } catch {
      // Ignore poll errors — will retry on next interval
    }
  }, [songId, onComplete]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (connectionStatus === "disconnected" && !isComplete && !isFailed) {
      if (pollIntervalRef.current === null) {
        void doPoll();
        pollIntervalRef.current = setInterval(() => void doPoll(), 3000);
      }
    } else {
      if (pollIntervalRef.current !== null) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    return () => {
      if (pollIntervalRef.current !== null) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [connectionStatus, isComplete, isFailed, doPoll]);

  // ── Determine if a reference stage is present (from WebSocket or song data) ──
  const hasReference = stages.some((s) => s.stage === "reference");

  // ── Build dynamic stage list ─────────────────────────────────────────────────
  const dynamicStages = hasReference
    ? [REFERENCE_STAGE, ...BASE_STAGES]
    : [...BASE_STAGES];

  // ── Build per-stage display status ──────────────────────────────────────────

  let stageStatuses: Record<string, StageDisplayStatus>;

  if (stages.length > 0) {
    stageStatuses = resolveStageStatuses(stages, isFailed);
  } else if (pollStagesRef.current) {
    const poll = pollStagesRef.current;
    const pollResult: Record<string, StageDisplayStatus> = {};
    for (const key of poll.completed) {
      pollResult[key] = "completed";
    }
    if (poll.inProgress) {
      pollResult[poll.inProgress] = "in_progress";
    }
    if (poll.failed) {
      for (const s of dynamicStages) {
        if (pollResult[s.key] === "in_progress") {
          pollResult[s.key] = "failed";
        }
      }
    }
    stageStatuses = pollResult;
  } else {
    stageStatuses = {};
  }

  // Count completed stages for ambient gradient
  const completedCount = dynamicStages.filter((s) => stageStatuses[s.key] === "completed").length;

  // ── Connection status badge ──────────────────────────────────────────────────
  const wsStatusBadge =
    connectionStatus === "connected" ? null : connectionStatus === "connecting" ? (
      <span className="text-amber text-xs flex items-center gap-1.5" style={{ color: "var(--color-amber-light)" }}>
        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        Connecting…
      </span>
    ) : (
      <span className="text-gray-500 text-xs flex items-center gap-1">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: "#4b5563", animation: "pulse 2s ease-in-out infinite" }}
        />
        Polling for updates…
      </span>
    );

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: isFailed
          ? "linear-gradient(180deg, rgba(231,76,60,0.08) 0%, var(--color-surface-1) 100%)"
          : "linear-gradient(180deg, var(--color-surface-2) 0%, var(--color-surface-1) 100%)",
        border: isFailed
          ? "1px solid rgba(231,76,60,0.25)"
          : "1px solid rgba(240,165,0,0.15)",
      }}
    >
      <style>{`
        @keyframes drawCheck {
          from { stroke-dashoffset: 28; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.8; }
          70%  { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>

      {/* Animated ambient background — shifts warmer as stages complete */}
      {!isComplete && !isFailed && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: progressGradient(completedCount, dynamicStages.length),
            transition: "background 1s ease",
          }}
          aria-hidden="true"
        />
      )}

      {/* Completion burst */}
      {isComplete && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, rgba(240,165,0,0.12) 0%, transparent 70%)",
          }}
          aria-hidden="true"
        />
      )}

      <div className="relative p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isComplete ? (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-base"
                style={{
                  background: "linear-gradient(135deg, rgba(240,165,0,0.25), rgba(255,209,102,0.15))",
                  border: "1px solid rgba(240,165,0,0.4)",
                }}
              >
                🎉
              </div>
            ) : isFailed ? (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(231,76,60,0.15)",
                  border: "1px solid rgba(231,76,60,0.3)",
                  color: "var(--color-coral)",
                  fontSize: "0.9rem",
                }}
              >
                ✗
              </div>
            ) : (
              <div className="relative w-8 h-8">
                {/* Musical note with pulsing glow */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                  style={{
                    background: "rgba(240,165,0,0.15)",
                    border: "1px solid rgba(240,165,0,0.3)",
                    animation: "pulseGlow 2s ease-in-out infinite",
                  }}
                >
                  🎵
                </div>
              </div>
            )}
            <h3
              className="font-bold text-white"
              style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem" }}
            >
              {isComplete
                ? "Your song is ready!"
                : isFailed
                  ? "Generation failed"
                  : "Creating your song…"}
            </h3>
          </div>
          {wsStatusBadge}
        </div>

        {/* Progress bar */}
        {!isFailed && (
          <div className="space-y-1.5">
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${(completedCount / dynamicStages.length) * 100}%`,
                  background: isComplete
                    ? "linear-gradient(90deg, var(--color-amber) 0%, var(--color-amber-light) 100%)"
                    : "linear-gradient(90deg, var(--color-amber) 0%, rgba(240,165,0,0.6) 100%)",
                  boxShadow: "0 0 8px rgba(240,165,0,0.4)",
                }}
              />
            </div>
            <p className="text-right text-xs" style={{ color: "rgba(156,163,175,0.6)" }}>
              {completedCount}/{dynamicStages.length} stages
            </p>
          </div>
        )}

        {/* Stage list */}
        <ol className="space-y-3">
          {dynamicStages.map(({ key, label, symbol }, index) => {
            const displayStatus: StageDisplayStatus = stageStatuses[key] ?? "pending";
            const isActive = displayStatus === "in_progress";

            return (
              <li key={key} className="flex items-center gap-3.5">
                <StageIcon
                  displayStatus={displayStatus}
                  symbol={symbol}
                  index={index}
                />

                {/* Connector line between icons */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-medium transition-colors duration-300"
                      style={{
                        fontFamily: "var(--font-display)",
                        color:
                          displayStatus === "completed"
                            ? "var(--color-teal)"
                            : displayStatus === "in_progress"
                              ? "var(--color-amber-light)"
                              : displayStatus === "failed"
                                ? "var(--color-coral)"
                                : "rgba(107,114,128,0.8)",
                      }}
                    >
                      {label}
                    </span>

                    {/* Stage message from WebSocket */}
                    {isActive && (() => {
                      const ws = stages.find((s) => s.stage === key);
                      return ws?.message ? (
                        <span className="text-xs truncate" style={{ color: "rgba(156,163,175,0.6)" }}>
                          — {ws.message}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>

                {/* Active indicator badge */}
                {isActive && (
                  <span
                    className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: "rgba(240,165,0,0.15)",
                      border: "1px solid rgba(240,165,0,0.25)",
                      color: "var(--color-amber)",
                      fontFamily: "var(--font-display)",
                      fontSize: "0.65rem",
                      letterSpacing: "0.05em",
                      animation: "pulse 2s ease-in-out infinite",
                    }}
                  >
                    LIVE
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {/* Error message */}
        {isFailed && (error ?? true) && (
          <div
            className="rounded-xl px-4 py-3 text-sm flex items-start gap-2.5"
            style={{
              background: "rgba(231,76,60,0.08)",
              border: "1px solid rgba(231,76,60,0.2)",
              color: "var(--color-coral)",
            }}
          >
            <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
              <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
            </svg>
            {error ?? "An error occurred during generation. Your credits have been refunded."}
          </div>
        )}
      </div>
    </div>
  );
}
