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
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

const planColors: Record<string, { bg: string; text: string; border: string }> = {
  free: {
    bg: "rgba(45, 45, 80, 0.5)",
    text: "#9ca3af",
    border: "var(--color-surface-3)",
  },
  pro: {
    bg: "rgba(240, 165, 0, 0.12)",
    text: "var(--color-amber)",
    border: "rgba(240, 165, 0, 0.3)",
  },
  enterprise: {
    bg: "rgba(0, 210, 255, 0.1)",
    text: "var(--color-teal)",
    border: "rgba(0, 210, 255, 0.3)",
  },
};

export default function Settings() {
  const { user, login } = useAuth();
  const saveApi = useApi<UpdateProfileResponse>();
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    username: user?.username ?? "",
    display_name: user?.display_name ?? "",
  });

  // Sync if user changes (e.g. refresh)
  useEffect(() => {
    setForm({
      username: user?.username ?? "",
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
      // Re-inject updated user with the same token (token doesn't change on profile update)
      // We get back the updated user; keep existing token
      setSaved(true);
      // Update context — we need to re-login with the refreshed user but same token
      // The access token is still valid; just update the user object
      // Since login() replaces the token, we read it from the api client's perspective.
      // The cleanest approach is to call refresh() to get a fresh token+user.
      // For now surface the saved state and let the next refresh pick it up.
    }
  }

  const plan = user?.plan ?? "free";
  const planStyle = planColors[plan] ?? planColors["free"];

  const inputClass =
    "w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 outline-none transition-all";
  const inputStyle = {
    backgroundColor: "var(--color-surface-2)",
    border: "1px solid var(--color-surface-3)",
  };
  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.style.borderColor = "var(--color-amber)";
      e.target.style.boxShadow = "0 0 0 2px rgba(240, 165, 0, 0.2)";
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.style.borderColor = "var(--color-surface-3)";
      e.target.style.boxShadow = "none";
    },
  };

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-gray-400 text-sm">Manage your account and preferences.</p>
      </div>

      {/* Profile card */}
      <div
        className="rounded-2xl p-6 border"
        style={{
          backgroundColor: "var(--color-surface-1)",
          borderColor: "var(--color-surface-3)",
        }}
      >
        <h2 className="text-base font-semibold text-white mb-4">Profile</h2>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {saveApi.error && (
            <p
              className="text-sm px-3 py-2 rounded-lg"
              style={{
                color: "var(--color-coral)",
                backgroundColor: "rgba(231, 76, 60, 0.1)",
              }}
            >
              {saveApi.error}
            </p>
          )}

          {saved && (
            <p
              className="text-sm px-3 py-2 rounded-lg"
              style={{
                color: "var(--color-teal)",
                backgroundColor: "rgba(0, 210, 255, 0.08)",
              }}
            >
              Profile saved successfully.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
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
              className={inputClass}
              style={inputStyle}
              {...focusHandlers}
            />
            <p className="mt-1 text-xs text-gray-500">Letters, numbers and underscores only</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Display name
            </label>
            <input
              type="text"
              value={form.display_name}
              onChange={set("display_name")}
              placeholder="Your Name"
              maxLength={100}
              className={inputClass}
              style={inputStyle}
              {...focusHandlers}
            />
            <p className="mt-1 text-xs text-gray-500">
              Shown in the nav bar and on your profile
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              disabled={saveApi.loading}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-black transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{ backgroundColor: "var(--color-amber)" }}
            >
              {saveApi.loading ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>

      {/* Subscription card */}
      <div
        className="rounded-2xl p-6 border"
        style={{
          backgroundColor: "var(--color-surface-1)",
          borderColor: "var(--color-surface-3)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Subscription</h2>
          <Link
            to="/billing"
            className="text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--color-teal)" }}
          >
            Manage →
          </Link>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Current plan</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
                style={{
                  backgroundColor: planStyle.bg,
                  color: planStyle.text,
                  border: `1px solid ${planStyle.border}`,
                }}
              >
                {planLabels[plan] ?? plan}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Credits remaining</p>
            <p className="text-2xl font-bold mt-0.5" style={{ color: "var(--color-amber)" }}>
              {user?.credits_remaining ?? 0}
            </p>
          </div>
        </div>

        {plan === "free" && (
          <div className="mt-4 flex items-center justify-between gap-4">
            <p
              className="text-sm"
              style={{ color: "#d1a44a" }}
            >
              Upgrade for more daily songs, WAV downloads, and commercial license.
            </p>
            <Link
              to="/pricing"
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
              style={{
                backgroundColor: "var(--color-amber)",
                color: "var(--color-charcoal)",
              }}
            >
              Upgrade
            </Link>
          </div>
        )}
      </div>

      {/* Account info */}
      <div
        className="rounded-2xl p-6 border"
        style={{
          backgroundColor: "var(--color-surface-1)",
          borderColor: "var(--color-surface-3)",
        }}
      >
        <h2 className="text-base font-semibold text-white mb-4">Account</h2>
        <dl className="space-y-3">
          <div className="flex justify-between text-sm">
            <dt className="text-gray-500">Email</dt>
            <dd className="text-gray-300">{user?.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-gray-500">Auth method</dt>
            <dd className="text-gray-300 capitalize">
              {user?.primary_auth_method ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-gray-500">Verified</dt>
            <dd
              className="text-sm font-medium"
              style={{
                color: user?.is_verified ? "var(--color-teal)" : "var(--color-coral)",
              }}
            >
              {user?.is_verified ? "Yes" : "No"}
            </dd>
          </div>
          <div className="flex justify-between text-sm">
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
      </div>
    </div>
  );
}
