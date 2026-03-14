import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import type { User } from "@melodia/shared";

interface RegisterResponse {
  access_token: string;
  user: User;
}

/* ── Shared input helpers ─────────────────────────────── */
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
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 100% 80% at 50% 0%, rgba(22,22,60,0.8) 0%, transparent 60%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          top: -200,
          right: -100,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(240,165,0,0.1) 0%, transparent 70%)",
          filter: "blur(60px)",
          animation: "orb-drift-1 22s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          bottom: -180,
          left: -120,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(18,18,90,0.55) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "orb-drift-2 28s ease-in-out infinite",
        }}
      />
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

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const registerApi = useApi<RegisterResponse>();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = await registerApi.call(() =>
      api.post<RegisterResponse>("/api/auth/register", form)
    );
    if (data) {
      login(data.access_token, data.user);
      void navigate("/dashboard");
    }
  }

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
          <p className="mt-3 text-slate-400 text-sm">Start your creative journey</p>
        </div>

        {/* Card */}
        <div
          className="glass-card rounded-2xl p-7 anim-fadeup"
          style={{ animationDelay: "0.12s" }}
        >
          {/* Card header */}
          <div className="mb-6">
            <h1
              className="text-lg font-bold text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Create your free account
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">No credit card required</p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {registerApi.error && (
              <div
                className="text-sm px-4 py-3 rounded-xl"
                role="alert"
                style={{
                  color: "#fca5a5",
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                {registerApi.error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(148,163,184,0.8)", fontFamily: "var(--font-display)" }}>
                Username
              </label>
              <input
                type="text"
                value={form.username}
                onChange={set("username")}
                placeholder="beatmaker99"
                required
                minLength={3}
                maxLength={30}
                pattern="^[a-zA-Z0-9_]+$"
                className={inputClass}
                {...focusHandlers}
              />
              <p className="mt-1.5 text-xs text-slate-600">Letters, numbers and underscores only</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(148,163,184,0.8)", fontFamily: "var(--font-display)" }}>
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="you@example.com"
                required
                className={inputClass}
                {...focusHandlers}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(148,163,184,0.8)", fontFamily: "var(--font-display)" }}>
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={set("password")}
                placeholder="••••••••"
                required
                minLength={8}
                className={inputClass}
                {...focusHandlers}
              />
              <p className="mt-1.5 text-xs text-slate-600">Minimum 8 characters</p>
            </div>

            <button
              type="submit"
              disabled={registerApi.loading}
              className="btn-primary w-full py-3 rounded-xl text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer"
            >
              {registerApi.loading ? "Creating account…" : "Create Account →"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5" aria-hidden="true">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: "rgba(45,45,88,0.6)" }} />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 text-xs text-slate-600" style={{ background: "rgba(22,22,46,0.9)" }}>
                or
              </span>
            </div>
          </div>

          {/* Google sign up */}
          <a
            href="/api/auth/google"
            className="btn-ghost flex items-center justify-center gap-3 w-full py-3 rounded-xl text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
              <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
              <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
              <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
            </svg>
            Sign up with Google
          </a>
        </div>

        {/* Sign in link */}
        <p className="text-center mt-6 text-sm text-slate-600 anim-fadeup" style={{ animationDelay: "0.25s" }}>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold transition-colors hover:text-amber-400"
            style={{ color: "rgba(240,165,0,0.85)", fontFamily: "var(--font-display)" }}
          >
            Sign in →
          </Link>
        </p>
      </div>
    </div>
  );
}
