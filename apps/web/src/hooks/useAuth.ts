import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
  createElement,
} from "react";
import { api } from "../lib/api";
import type { User } from "@melodia/shared";

// ─── State & Actions ────────────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

type AuthAction =
  | { type: "SET_USER"; payload: { user: User; token: string } }
  | { type: "LOGOUT" }
  | { type: "SET_LOADING"; payload: boolean };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SET_USER":
      api.setAccessToken(action.payload.token);
      return {
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
      };
    case "LOGOUT":
      api.setAccessToken(null);
      return { user: null, isAuthenticated: false, isLoading: false };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface AuthContextValue extends AuthState {
  login: (accessToken: string, user: User) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

interface RefreshResponse {
  access_token: string;
  user: User;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const data = await api.post<RefreshResponse>("/api/auth/refresh", undefined, {
        // skip the 401 retry to avoid infinite loop
        headers: {},
      });
      dispatch({ type: "SET_USER", payload: { user: data.user, token: data.access_token } });
      return true;
    } catch {
      dispatch({ type: "LOGOUT" });
      return false;
    }
  }, []);

  // Wire up the 401 handler so all subsequent API calls can auto-refresh
  useEffect(() => {
    api.setOnUnauthorized(refresh);
  }, [refresh]);

  // Attempt silent refresh on mount
  useEffect(() => {
    dispatch({ type: "SET_LOADING", payload: true });
    refresh().finally(() => {
      // SET_LOADING is handled inside SET_USER / LOGOUT dispatches,
      // but if refresh throws for a reason other than 401 (network error),
      // we still want to stop the loading spinner.
      dispatch({ type: "SET_LOADING", payload: false });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback((accessToken: string, user: User) => {
    dispatch({ type: "SET_USER", payload: { user, token: accessToken } });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // Ignore errors — we always clear local state
    }
    dispatch({ type: "LOGOUT" });
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    refresh,
  };

  return createElement(AuthContext.Provider, { value }, children);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
