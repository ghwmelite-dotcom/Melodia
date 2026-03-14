import { useEffect, useRef, useCallback } from "react";
import { useWebSocket, type StageUpdate } from "../../hooks/useWebSocket.js";
import { api } from "../../lib/api.js";

// ─── Types ─────────────────────────────────────────────────────────────────────

type GenerationProgressProps = {
  songId: string;
  onComplete?: () => void;
};

// ─── Stage definitions ─────────────────────────────────────────────────────────

const STAGES = [
  { key: "blueprint", label: "Creating blueprint" },
  { key: "lyrics", label: "Writing lyrics" },
  { key: "refinement", label: "Refining lyrics" },
  { key: "music", label: "Generating music" },
  { key: "artwork", label: "Creating artwork" },
  { key: "processing", label: "Finalizing" },
  { key: "completed", label: "Complete" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

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

/**
 * Maps a coarse DB status string to a set of stage keys that are "completed"
 * and the current "in_progress" stage key.
 */
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

function StageIcon({ displayStatus }: { displayStatus: StageDisplayStatus }) {
  if (displayStatus === "completed") {
    return (
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-teal/20 text-teal text-sm font-bold select-none">
        ✓
      </span>
    );
  }

  if (displayStatus === "in_progress") {
    return (
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber/20 text-amber text-sm select-none">
        <svg
          className="w-3.5 h-3.5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      </span>
    );
  }

  if (displayStatus === "failed") {
    return (
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-coral/20 text-coral text-sm font-bold select-none">
        ✗
      </span>
    );
  }

  // pending
  return (
    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-surface-3 text-gray-500 text-sm select-none">
      ○
    </span>
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

  // If the whole job failed and we haven't set a specific stage as failed,
  // mark it on the current in_progress stage if any
  if (isFailed) {
    for (const key of Object.keys(result)) {
      if (result[key] === "in_progress") {
        result[key] = "failed";
      }
    }
  }

  return result;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function GenerationProgress({ songId, onComplete }: GenerationProgressProps) {
  const { connectionStatus, stages, isComplete, isFailed, error } = useWebSocket(songId);

  // Track whether onComplete has been called
  const completedCalledRef = useRef(false);

  // Polling fallback refs
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  // Polling state (stored via ref to avoid re-render loop in effect deps)
  const pollStagesRef = useRef<{ completed: StageKey[]; inProgress: StageKey | null; failed: boolean } | null>(null);

  // ── Call onComplete once when done ──────────────────────────────────────────
  useEffect(() => {
    if (isComplete && !completedCalledRef.current) {
      completedCalledRef.current = true;
      onComplete?.();
    }
  }, [isComplete, onComplete]);

  // ── Poll fallback ────────────────────────────────────────────────────────────

  const doPoll = useCallback(async () => {
    if (!isMountedRef.current) return;
    try {
      const res = await api.get<StatusPollResponse>(`/api/songs/${songId}/status`);
      if (!isMountedRef.current) return;

      pollStagesRef.current = dbStatusToStages(res.status);

      if (res.status === "completed" && !completedCalledRef.current) {
        completedCalledRef.current = true;
        onComplete?.();
        // Clear polling — no longer needed
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

  // Start/stop polling based on connection status
  useEffect(() => {
    if (connectionStatus === "disconnected" && !isComplete && !isFailed) {
      // Start polling if not already polling
      if (pollIntervalRef.current === null) {
        void doPoll(); // immediate first poll
        pollIntervalRef.current = setInterval(() => void doPoll(), 3000);
      }
    } else {
      // WS is connected or done — stop polling
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

  // ── Build per-stage display status ──────────────────────────────────────────

  // If WS has stages, use those; else if polling has data, use that
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
      for (const s of STAGES) {
        if (pollResult[s.key] === "in_progress") {
          pollResult[s.key] = "failed";
        }
      }
    }
    stageStatuses = pollResult;
  } else {
    stageStatuses = {};
  }

  // ── Connection status badge ──────────────────────────────────────────────────
  const wsStatusBadge =
    connectionStatus === "connected" ? null : connectionStatus === "connecting" ? (
      <span className="text-amber text-xs flex items-center gap-1">
        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        Connecting…
      </span>
    ) : (
      <span className="text-gray-400 text-xs">Polling for updates…</span>
    );

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${isFailed ? "border-coral/30 bg-coral/5" : "border-surface-3 bg-surface-1"} p-6`}
    >
      {/* Pulsing ambient background during active generation */}
      {!isComplete && !isFailed && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(240,165,0,0.06) 0%, transparent 70%)",
            animation: "pulse 3s ease-in-out infinite",
          }}
          aria-hidden="true"
        />
      )}

      <div className="relative space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">
            {isComplete ? "Generation complete" : isFailed ? "Generation failed" : "Creating your song…"}
          </h3>
          {wsStatusBadge}
        </div>

        {/* Stage list */}
        <ol className="space-y-3">
          {STAGES.map(({ key, label }) => {
            const displayStatus: StageDisplayStatus = stageStatuses[key] ?? "pending";
            const isActive = displayStatus === "in_progress";

            return (
              <li key={key} className="flex items-center gap-3">
                <StageIcon displayStatus={displayStatus} />
                <span
                  className={`text-sm ${
                    displayStatus === "completed"
                      ? "text-teal"
                      : displayStatus === "in_progress"
                        ? "text-amber font-medium"
                        : displayStatus === "failed"
                          ? "text-coral"
                          : "text-gray-500"
                  } ${isActive ? "animate-pulse" : ""}`}
                >
                  {label}
                </span>
                {/* Stage-level message from WebSocket */}
                {isActive && (() => {
                  const ws = stages.find((s) => s.stage === key);
                  return ws?.message ? (
                    <span className="text-xs text-gray-400 ml-1">— {ws.message}</span>
                  ) : null;
                })()}
              </li>
            );
          })}
        </ol>

        {/* Error message */}
        {isFailed && (error ?? true) && (
          <div className="mt-2 rounded-xl bg-coral/10 border border-coral/20 px-4 py-3 text-coral text-sm">
            {error ?? "An error occurred during generation. Your credits have been refunded."}
          </div>
        )}
      </div>
    </div>
  );
}
