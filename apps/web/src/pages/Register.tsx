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
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: "var(--color-charcoal)" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link
            to="/"
            className="text-2xl font-bold"
            style={{ color: "var(--color-amber)" }}
          >
            Melodia
          </Link>
          <p className="mt-2 text-gray-400 text-sm">Create your free account</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6 border"
          style={{
            backgroundColor: "var(--color-surface-1)",
            borderColor: "var(--color-surface-3)",
          }}
        >
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {registerApi.error && (
              <p
                className="text-sm px-3 py-2 rounded-lg"
                style={{
                  color: "var(--color-coral)",
                  backgroundColor: "rgba(231, 76, 60, 0.1)",
                }}
              >
                {registerApi.error}
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
                required
                minLength={3}
                maxLength={30}
                pattern="^[a-zA-Z0-9_]+$"
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 outline-none transition-all"
                style={inputStyle}
                {...focusHandlers}
              />
              <p className="mt-1 text-xs text-gray-500">Letters, numbers and underscores only</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 outline-none transition-all"
                style={inputStyle}
                {...focusHandlers}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={set("password")}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 outline-none transition-all"
                style={inputStyle}
                {...focusHandlers}
              />
              <p className="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
            </div>

            <button
              type="submit"
              disabled={registerApi.loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-black transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
              style={{ backgroundColor: "var(--color-amber)" }}
            >
              {registerApi.loading ? "Creating account…" : "Create Account"}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium hover:underline"
            style={{ color: "var(--color-amber)" }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
