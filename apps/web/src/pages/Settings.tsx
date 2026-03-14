import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import type { User } from "@melodia/shared";

interface UpdateProfileResponse {
  user: User;
}

const planLabels: Record<string, string> = {
  free:       "Free",
  creator:    "Creator",
  pro:        "Pro",
  enterprise: "Enterprise",
};

const planStyles: Record<string, React.CSSProperties> = {
  free: {
    backgroundColor: "rgba(255,255,255,0.05)",
    color: "#9ca3af",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  creator: {
    backgroundColor: "rgba(240,165,0,0.12)",
    color: "var(--color-amber)",
    border: "1px solid rgba(240,165,0,0.25)",
  },
  pro: {
    backgroundColor: "rgba(0,210,255,0.1)",
    color: "var(--color-teal)",
    border: "1px solid rgba(0,210,255,0.25)",
  },
  enterprise: {
    backgroundColor: "rgba(0,210,255,0.1)",
    color: "var(--color-teal)",
    border: "1px solid rgba(0,210,255,0.25)",
  },
};

// ─── Section Card wrapper ─────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={
        accent
          ? {
              background: "linear-gradient(160deg, rgba(240,165,0,0.04) 0%, var(--color-surface-1) 100%)",
              borderColor: "rgba(240,165,0,0.12)",
            }
          : {
              backgroundColor: "var(--color-surface-1)",
              borderColor: "rgba(255,255,255,0.06)",
            }
      }
    >
      {/* Section header */}
      <div
        className="px-6 py-4 border-b"
        style={{
          borderColor: accent ? "rgba(240,165,0,0.08)" : "rgba(255,255,255,0.05)",
        }}
      >
        <h2
          className="text-sm font-bold text-white tracking-tight"
          style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}
        >
          {title}
        </h2>
      </div>

      <div className="p-6">{children}</div>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Settings() {
  const { user, login } = useAuth();
  const saveApi = useApi<UpdateProfileResponse>();
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    username:     user?.username ?? "",
    display_name: user?.display_name ?? "",
  });

  useEffect(() => {
    setForm({
      username:     user?.username ?? "",
      display_name: user?.display_name ?? "",
    });
  }, [user]);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setSaved(false);
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const payload: Record<string, string> = {};
    if (form.username) payload["username"] = form.username;
    if (form.display_name !== undefined) payload["display_name"] = form.display_name;

    const data = await saveApi.call(() =>
      api.put<UpdateProfileResponse>("/api/settings/profile", payload)
    );
    if (data) {
      setSaved(true);
    }
  }

  const plan      = user?.plan ?? "free";
  const planStyle = planStyles[plan] ?? planStyles["free"]!;
  const isPaidPlan = plan !== "free";

  const inputBase: React.CSSProperties = {
    backgroundColor: "var(--color-surface-2)",
    border: "1px solid rgba(255,255,255,0.08)",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  };

  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.style.borderColor = "var(--color-amber)";
      e.target.style.boxShadow = "0 0 0 3px rgba(240,165,0,0.12)";
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.style.borderColor = "rgba(255,255,255,0.08)";
      e.target.style.boxShadow = "none";
    },
  };

  return (
    <div className="space-y-6 max-w-xl">
      {/* Page header */}
      <div>
        <h1
          className="text-3xl font-bold text-white"
          style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}
        >
          Settings
        </h1>
        <p className="mt-1 text-gray-500 text-sm">Manage your account and preferences.</p>
      </div>

      {/* Profile section */}
      <SectionCard title="Profile">
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          {/* Error */}
          {saveApi.error && (
            <div
              className="flex items-start gap-2 text-sm px-4 py-3 rounded-xl"
              style={{
                color: "var(--color-coral)",
                backgroundColor: "rgba(231,76,60,0.08)",
                border: "1px solid rgba(231,76,60,0.15)",
              }}
            >
              <span className="text-base leading-tight flex-shrink-0">✗</span>
              <span>{saveApi.error}</span>
            </div>
          )}

          {/* Success */}
          {saved && (
            <div
              className="flex items-center gap-2 text-sm px-4 py-3 rounded-xl"
              style={{
                color: "var(--color-teal)",
                backgroundColor: "rgba(0,210,255,0.06)",
                border: "1px solid rgba(0,210,255,0.15)",
              }}
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Profile saved successfully.
            </div>
          )}

          {/* Username */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-300">
              Username
            </label>
            <input
              type="text"
              value={form.username}
              onChange={set("username")}
              placeholder="beatmaker99"
              minLength={3}
              maxLength={30}
              pattern="^[a-zA-Z0-9_]+$"
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none"
              style={inputBase}
              {...focusHandlers}
            />
            <p className="text-xs text-gray-600">Letters, numbers and underscores only.</p>
          </div>

          {/* Display name */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-300">
              Display name
            </label>
            <input
              type="text"
              value={form.display_name}
              onChange={set("display_name")}
              placeholder="Your Name"
              maxLength={100}
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none"
              style={inputBase}
              {...focusHandlers}
            />
            <p className="text-xs text-gray-600">
              Shown in the nav bar and on your profile.
            </p>
          </div>

          {/* Submit */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={saveApi.loading}
              className="px-6 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{
                backgroundColor: "var(--color-amber)",
                color: "var(--color-charcoal)",
                boxShadow: saveApi.loading ? "none" : "0 2px 14px rgba(240,165,0,0.3)",
              }}
            >
              {saveApi.loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                  Saving…
                </span>
              ) : (
                "Save changes"
              )}
            </button>
          </div>
        </form>
      </SectionCard>

      {/* Subscription section */}
      <SectionCard title="Subscription" accent>
        <div className="space-y-4">
          {/* Plan + credits row */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500">Current plan</p>
              <span
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-bold"
                style={planStyle}
              >
                {isPaidPlan && <span className="text-base leading-none">⭐</span>}
                {planLabels[plan] ?? plan}
              </span>
            </div>

            <div className="text-right space-y-0.5">
              <p className="text-xs text-gray-500">Credits remaining</p>
              <p
                className="text-3xl font-bold tabular-nums leading-tight"
                style={{
                  color: "var(--color-amber)",
                  fontFamily: "'Outfit', 'Sora', sans-serif",
                }}
              >
                {user?.credits_remaining ?? 0}
              </p>
            </div>
          </div>

          {/* Upgrade nudge for free plan */}
          {!isPaidPlan && (
            <div
              className="rounded-xl p-4 flex items-center justify-between gap-4"
              style={{
                background: "rgba(240,165,0,0.05)",
                border: "1px solid rgba(240,165,0,0.1)",
              }}
            >
              <p className="text-sm text-gray-400 leading-snug">
                Upgrade for more daily songs, WAV downloads, and commercial license.
              </p>
              <Link
                to="/pricing"
                className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all hover:opacity-90 active:scale-95"
                style={{
                  backgroundColor: "var(--color-amber)",
                  color: "var(--color-charcoal)",
                  boxShadow: "0 2px 10px rgba(240,165,0,0.3)",
                }}
              >
                Upgrade
              </Link>
            </div>
          )}

          {/* Manage link */}
          <div className="flex items-center justify-between pt-1">
            <Link
              to="/billing"
              className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
              style={{ color: "var(--color-teal)" }}
            >
              Manage billing & payments
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </SectionCard>

      {/* Account info section */}
      <SectionCard title="Account">
        <dl className="space-y-4">
          {[
            { label: "Email",        value: user?.email ?? "—", mono: true },
            { label: "Auth method",  value: user?.primary_auth_method ?? "—", capitalize: true },
          ].map(({ label, value, mono, capitalize }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <dt className="text-gray-500">{label}</dt>
              <dd
                className={`text-gray-300 ${mono ? "font-mono text-xs" : ""} ${capitalize ? "capitalize" : ""}`}
              >
                {value}
              </dd>
            </div>
          ))}

          {/* Verified */}
          <div className="flex items-center justify-between text-sm">
            <dt className="text-gray-500">Email verified</dt>
            <dd>
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={
                  user?.is_verified
                    ? { backgroundColor: "rgba(0,210,255,0.1)", color: "var(--color-teal)", border: "1px solid rgba(0,210,255,0.18)" }
                    : { backgroundColor: "rgba(231,76,60,0.1)", color: "var(--color-coral)", border: "1px solid rgba(231,76,60,0.18)" }
                }
              >
                {user?.is_verified ? (
                  <>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Verified
                  </>
                ) : (
                  "Not verified"
                )}
              </span>
            </dd>
          </div>

          {/* Member since */}
          <div className="flex items-center justify-between text-sm">
            <dt className="text-gray-500">Member since</dt>
            <dd className="text-gray-300">
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </dd>
          </div>
        </dl>
      </SectionCard>
    </div>
  );
}
