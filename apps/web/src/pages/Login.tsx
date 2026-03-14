import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import type { User } from "@melodia/shared";

type Tab = "email" | "phone" | "google";

interface LoginResponse {
  access_token: string;
  user: User;
}

interface OtpSendResponse {
  message: string;
}

/* ── Shared input props helper ────────────────────────── */
const inputClass =
  "input-field w-full px-4 py-3 rounded-xl text-sm outline-none";

const focusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "rgba(240,165,0,0.6)";
    e.target.style.boxShadow = "0 0 0 3px rgba(240,165,0,0.12), 0 0 20px rgba(240,165,0,0.08)";
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "rgba(45,45,88,0.8)";
    e.target.style.boxShadow = "none";
  },
};

/* ── Ambient background ───────────────────────────────── */
function AuthBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Deep gradient base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 100% 80% at 50% 0%, rgba(22,22,60,0.8) 0%, transparent 60%)",
        }}
      />
      {/* Amber orb top-left */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          top: -200,
          left: -150,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(240,165,0,0.12) 0%, transparent 70%)",
          filter: "blur(60px)",
          animation: "orb-drift-1 20s ease-in-out infinite",
        }}
      />
      {/* Blue-midnight orb bottom-right */}
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          bottom: -150,
          right: -100,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(18,18,90,0.6) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "orb-drift-2 25s ease-in-out infinite",
        }}
      />
      {/* Subtle grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(240,165,0,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(240,165,0,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("email");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const emailApi = useApi<LoginResponse>();

  const [phone, setPhone] = useState("+233");
  const phoneApi = useApi<OtpSendResponse>();

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = await emailApi.call(() =>
      api.post<LoginResponse>("/api/auth/login", { email, password })
    );
    if (data) {
      login(data.access_token, data.user);
      void navigate("/dashboard");
    }
  }

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = await phoneApi.call(() =>
      api.post<OtpSendResponse>("/api/auth/otp/send", { phone })
    );
    if (data) {
      void navigate(`/verify-otp?phone=${encodeURIComponent(phone)}`);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "email", label: "Email" },
    { id: "phone", label: "Phone" },
    { id: "google", label: "Google" },
  ];

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: "var(--color-charcoal)" }}
    >
      <AuthBackground />

      <div className="relative z-10 w-full max-w-sm anim-fadescale" style={{ animationDelay: "0s" }}>
        {/* Logo */}
        <div className="text-center mb-8 anim-fadeup" style={{ animationDelay: "0.05s" }}>
          <Link to="/" className="inline-flex flex-col items-center gap-2 group">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1 transition-all duration-300 group-hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #F0A500 0%, #D4920A 100%)",
                boxShadow: "0 4px 24px rgba(240,165,0,0.4)",
              }}
            >
              <span
                className="text-xl font-black text-black"
                style={{ fontFamily: "var(--font-display)" }}
              >
                M
              </span>
            </div>
            <span
              className="text-2xl font-bold"
              style={{
                fontFamily: "var(--font-display)",
                background: "linear-gradient(135deg, #F0A500 0%, #FFD166 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Melodia
            </span>
          </Link>
          <p className="mt-3 text-slate-400 text-sm">Welcome back, creator</p>
        </div>

        {/* Card */}
        <div
          className="glass-card rounded-2xl p-7 anim-fadeup"
          style={{ animationDelay: "0.12s" }}
        >
          {/* Tab switcher */}
          <div
            className="flex rounded-xl p-1 mb-6"
            style={{ background: "rgba(18,18,42,0.6)" }}
            role="tablist"
            aria-label="Sign in method"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer"
                style={{
                  fontFamily: "var(--font-display)",
                  ...(activeTab === tab.id
                    ? {
                        background: "linear-gradient(135deg, rgba(240,165,0,0.18), rgba(240,165,0,0.08))",
                        color: "#FFD166",
                        border: "1px solid rgba(240,165,0,0.25)",
                        boxShadow: "0 2px 12px rgba(240,165,0,0.1)",
                      }
                    : {
                        color: "rgba(148,163,184,0.6)",
                        border: "1px solid transparent",
                      }),
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Email tab */}
          {activeTab === "email" && (
            <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-4">
              {emailApi.error && (
                <div
                  className="text-sm px-4 py-3 rounded-xl"
                  role="alert"
                  style={{
                    color: "#fca5a5",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  {emailApi.error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(148,163,184,0.8)", fontFamily: "var(--font-display)" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className={inputClass}
                  {...focusHandlers}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(148,163,184,0.8)", fontFamily: "var(--font-display)" }}>
                    Password
                  </label>
                  <Link
                    to="/reset-password"
                    className="text-xs transition-colors hover:text-amber-400"
                    style={{ color: "rgba(240,165,0,0.7)" }}
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={inputClass}
                  {...focusHandlers}
                />
              </div>

              <button
                type="submit"
                disabled={emailApi.loading}
                className="btn-primary w-full py-3 rounded-xl text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer"
              >
                {emailApi.loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
          )}

          {/* Phone tab */}
          {activeTab === "phone" && (
            <form onSubmit={(e) => void handlePhoneSubmit(e)} className="space-y-4">
              {phoneApi.error && (
                <div
                  className="text-sm px-4 py-3 rounded-xl"
                  role="alert"
                  style={{
                    color: "#fca5a5",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  {phoneApi.error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(148,163,184,0.8)", fontFamily: "var(--font-display)" }}>
                  Phone number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+233XXXXXXXXX"
                  required
                  className={inputClass}
                  {...focusHandlers}
                />
                <p className="mt-1.5 text-xs text-slate-600">Format: +233XXXXXXXXX (Ghana)</p>
              </div>

              <button
                type="submit"
                disabled={phoneApi.loading}
                className="btn-primary w-full py-3 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer"
              >
                {phoneApi.loading ? "Sending code…" : "Send Code"}
              </button>
            </form>
          )}

          {/* Google tab */}
          {activeTab === "google" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400 text-center leading-relaxed">
                Sign in with your Google account instantly.
              </p>
              <a
                href="/api/auth/google"
                className="btn-ghost flex items-center justify-center gap-3 w-full py-3 rounded-xl text-sm"
              >
                <svg width="18" height="18" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
                  <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
                  <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
                  <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
                </svg>
                Continue with Google
              </a>
            </div>
          )}
        </div>

        {/* Register link */}
        <p className="text-center mt-6 text-sm text-slate-600 anim-fadeup" style={{ animationDelay: "0.22s" }}>
          No account yet?{" "}
          <Link
            to="/register"
            className="font-semibold transition-colors hover:text-amber-400"
            style={{ color: "rgba(240,165,0,0.85)", fontFamily: "var(--font-display)" }}
          >
            Create one free →
          </Link>
        </p>
      </div>
    </div>
  );
}
