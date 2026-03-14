import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import type { User } from "@melodia/shared";

interface ExchangeResponse {
  access_token: string;
  user: User;
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const calledRef = useRef(false);

  useEffect(() => {
    // Prevent double-invocation in React StrictMode
    if (calledRef.current) return;
    calledRef.current = true;

    const code = searchParams.get("code");
    if (!code) {
      void navigate("/login?error=missing_code");
      return;
    }

    api
      .post<ExchangeResponse>("/api/auth/exchange", { code })
      .then((data) => {
        login(data.access_token, data.user);
        void navigate("/dashboard");
      })
      .catch(() => {
        void navigate("/login?error=exchange_failed");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ backgroundColor: "var(--color-charcoal)" }}
    >
      <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: "var(--color-amber)", borderTopColor: "transparent" }}
      />
      <p className="text-sm text-gray-400">Completing sign-in…</p>
    </div>
  );
}
