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

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("email");

  // Email form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const emailApi = useApi<LoginResponse>();

  // Phone form state
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
          <p className="mt-2 text-gray-400 text-sm">Welcome back</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6 border"
          style={{
            backgroundColor: "var(--color-surface-1)",
            borderColor: "var(--color-surface-3)",
          }}
        >
          {/* Tabs */}
          <div
            className="flex rounded-xl p-1 mb-6"
            style={{ backgroundColor: "var(--color-surface-2)" }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
                style={
                  activeTab === tab.id
                    ? {
                        backgroundColor: "var(--color-surface-3)",
                        color: "white",
                      }
                    : { color: "#9ca3af" }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Email Tab */}
          {activeTab === "email" && (
            <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-4">
              {emailApi.error && (
                <p
                  className="text-sm px-3 py-2 rounded-lg"
                  style={{
                    color: "var(--color-coral)",
                    backgroundColor: "rgba(231, 76, 60, 0.1)",
                  }}
                >
                  {emailApi.error}
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 outline-none transition-all focus:ring-2"
                  style={{
                    backgroundColor: "var(--color-surface-2)",
                    border: "1px solid var(--color-surface-3)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--color-amber)";
                    e.target.style.boxShadow = "0 0 0 2px rgba(240, 165, 0, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--color-surface-3)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-300">
                    Password
                  </label>
                  <Link
                    to="/reset-password"
                    className="text-xs hover:underline"
                    style={{ color: "var(--color-amber)" }}
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
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 outline-none transition-all"
                  style={{
                    backgroundColor: "var(--color-surface-2)",
                    border: "1px solid var(--color-surface-3)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--color-amber)";
                    e.target.style.boxShadow = "0 0 0 2px rgba(240, 165, 0, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--color-surface-3)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={emailApi.loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-black transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: "var(--color-amber)" }}
              >
                {emailApi.loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
          )}

          {/* Phone Tab */}
          {activeTab === "phone" && (
            <form onSubmit={(e) => void handlePhoneSubmit(e)} className="space-y-4">
              {phoneApi.error && (
                <p
                  className="text-sm px-3 py-2 rounded-lg"
                  style={{
                    color: "var(--color-coral)",
                    backgroundColor: "rgba(231, 76, 60, 0.1)",
                  }}
                >
                  {phoneApi.error}
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Phone number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+233XXXXXXXXX"
                  required
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 outline-none transition-all"
                  style={{
                    backgroundColor: "var(--color-surface-2)",
                    border: "1px solid var(--color-surface-3)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--color-amber)";
                    e.target.style.boxShadow = "0 0 0 2px rgba(240, 165, 0, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--color-surface-3)";
                    e.target.style.boxShadow = "none";
                  }}
                />
                <p className="mt-1 text-xs text-gray-500">Format: +233XXXXXXXXX (Ghana)</p>
              </div>
              <button
                type="submit"
                disabled={phoneApi.loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-black transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: "var(--color-amber)" }}
              >
                {phoneApi.loading ? "Sending code…" : "Send Code"}
              </button>
            </form>
          )}

          {/* Google Tab */}
          {activeTab === "google" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400 text-center">
                Sign in with your Google account instantly.
              </p>
              <a
                href="/api/auth/google"
                className="flex items-center justify-center gap-3 w-full py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-95 border"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  borderColor: "var(--color-surface-3)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
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
        <p className="text-center mt-6 text-sm text-gray-500">
          No account yet?{" "}
          <Link
            to="/register"
            className="font-medium hover:underline"
            style={{ color: "var(--color-amber)" }}
          >
            Create one free
          </Link>
        </p>
      </div>
    </div>
  );
}
