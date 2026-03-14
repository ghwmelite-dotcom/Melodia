import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "./useAuth.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StageUpdate = {
  stage: string;
  status: "in_progress" | "completed" | "failed";
  message?: string;
  data?: Record<string, unknown>;
};

export type UseWebSocketReturn = {
  connectionStatus: "connecting" | "connected" | "disconnected";
  stages: StageUpdate[];
  currentStage: string | null;
  error: string | null;
  isComplete: boolean;
  isFailed: boolean;
};

type IncomingMessage = {
  type: "stage_update" | "state" | "error";
  stage?: string;
  status?: "in_progress" | "completed" | "failed";
  message?: string;
  data?: Record<string, unknown>;
  error?: string;
  generationState?: {
    songId: string;
    currentStage: string | null;
    stages: Partial<Record<string, "in_progress" | "completed" | "failed">>;
    completedAt?: string;
    error?: string;
  };
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWebSocket(songId: string): UseWebSocketReturn {
  const { accessToken } = useAuth();

  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [stages, setStages] = useState<StageUpdate[]>([]);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isFailed, setIsFailed] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasReconnectedRef = useRef(false);
  const isMountedRef = useRef(true);

  const buildWsUrl = useCallback(
    (token: string): string => {
      const apiBase = import.meta.env.VITE_API_URL as string | undefined;
      if (apiBase) {
        const wsUrl = apiBase.replace(/^http/, "ws");
        return `${wsUrl}/api/songs/${songId}/live?token=${encodeURIComponent(token)}`;
      }
      const { protocol, host } = window.location;
      const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
      return `${wsProtocol}//${host}/api/songs/${songId}/live?token=${encodeURIComponent(token)}`;
    },
    [songId]
  );

  const connect = useCallback(
    (token: string) => {
      if (!isMountedRef.current) return;

      const url = buildWsUrl(token);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      setConnectionStatus("connecting");

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setConnectionStatus("connected");
      };

      ws.onmessage = (event: MessageEvent) => {
        if (!isMountedRef.current) return;

        let msg: IncomingMessage;
        try {
          msg = JSON.parse(event.data as string) as IncomingMessage;
        } catch {
          return;
        }

        if (msg.type === "state" && msg.generationState) {
          // Hydrate from stored DO state
          const gs = msg.generationState;
          const hydratedStages: StageUpdate[] = Object.entries(gs.stages).map(
            ([stage, status]) => ({
              stage,
              status: status as "in_progress" | "completed" | "failed",
            })
          );
          setStages(hydratedStages);
          setCurrentStage(gs.currentStage);
          if (gs.currentStage === "completed") {
            setIsComplete(true);
          }
          if (gs.currentStage === "error" || gs.error) {
            setIsFailed(true);
            setError(gs.error ?? "Generation failed");
          }
        } else if (msg.type === "stage_update" && msg.stage && msg.status) {
          const update: StageUpdate = {
            stage: msg.stage,
            status: msg.status,
            message: msg.message,
            data: msg.data,
          };

          setStages((prev) => {
            // Replace existing stage entry if present, otherwise append
            const idx = prev.findIndex((s) => s.stage === msg.stage);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = update;
              return next;
            }
            return [...prev, update];
          });

          setCurrentStage(msg.stage);

          if (msg.stage === "completed" && msg.status === "completed") {
            setIsComplete(true);
          }
          if (msg.stage === "error" || msg.status === "failed") {
            setIsFailed(true);
          }
        } else if (msg.type === "error") {
          setError(msg.error ?? "An error occurred during generation");
          setIsFailed(true);
        }
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setConnectionStatus("disconnected");

        // Auto-reconnect once after 2 seconds
        if (!hasReconnectedRef.current && token) {
          hasReconnectedRef.current = true;
          reconnectTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connect(token);
            }
          }, 2000);
        }
      };

      ws.onerror = () => {
        if (!isMountedRef.current) return;
        setError("WebSocket connection error");
      };
    },
    [buildWsUrl]
  );

  useEffect(() => {
    isMountedRef.current = true;

    if (!accessToken) return;

    connect(accessToken);

    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on intentional unmount close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [accessToken, connect]);

  return {
    connectionStatus,
    stages,
    currentStage,
    error,
    isComplete,
    isFailed,
  };
}
