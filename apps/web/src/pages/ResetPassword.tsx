import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";

type Step = "request" | "confirm";

interface MessageResponse {
  message: string;
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("request");

  // Step 1 state
  const [email, setEmail] = useState("");
  const requestApi = useApi<MessageResponse>();

  // Step 2 state
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const confirmApi = useApi<MessageResponse>();

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    const data = await requestApi.call(() =>
      api.post<MessageResponse>("/api/auth/reset/request", { email })
    );
    if (data) {
      setStep("confirm");
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    const data = await confirmApi.call(() =>
      api.post<MessageResponse>("/api/auth/reset/confirm", {
        email,
        code,
        new_password: newPassword,
      })
    );
    if (data) {
      void navigate("/login?reset=success");
    }
  }

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
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: "var(--color-charcoal)" }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="text-2xl font-bold"
            style={{ color: "var(--color-amber)" }}
          >
            Melodia
          </Link>
          <h2 className="mt-4 text-xl font-semibold text-white">
            {step === "request" ? "Reset password" : "Enter verification code"}
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            {step === "request"
              ? "We'll send a 6-digit code to your email."
              : `Code sent to ${email}. Enter it below with your new password.`}
          </p>
        </div>

        <div
          className="rounded-2xl p-6 border"
          style={{
            backgroundColor: "var(--color-surface-1)",
            borderColor: "var(--color-surface-3)",
          }}
        >
          {step === "request" ? (
            <form onSubmit={(e) => void handleRequest(e)} className="space-y-4">
              {requestApi.error && (
                <p
                  className="text-sm px-3 py-2 rounded-lg"
                  style={{
                    color: "var(--color-coral)",
                    backgroundColor: "rgba(231, 76, 60, 0.1)",
                  }}
                >
                  {requestApi.error}
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className={inputClass}
                  style={inputStyle}
                  {...focusHandlers}
                />
              </div>
              <button
                type="submit"
                disabled={requestApi.loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-black transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: "var(--color-amber)" }}
              >
                {requestApi.loading ? "Sending…" : "Send Reset Code"}
              </button>
            </form>
          ) : (
            <form onSubmit={(e) => void handleConfirm(e)} className="space-y-4">
              {confirmApi.error && (
                <p
                  className="text-sm px-3 py-2 rounded-lg"
                  style={{
                    color: "var(--color-coral)",
                    backgroundColor: "rgba(231, 76, 60, 0.1)",
                  }}
                >
                  {confirmApi.error}
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Verification code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  required
                  maxLength={6}
                  className={inputClass}
                  style={inputStyle}
                  {...focusHandlers}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  New password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className={inputClass}
                  style={inputStyle}
                  {...focusHandlers}
                />
              </div>
              <button
                type="submit"
                disabled={confirmApi.loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-black transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: "var(--color-amber)" }}
              >
                {confirmApi.loading ? "Resetting…" : "Reset Password"}
              </button>
              <button
                type="button"
                onClick={() => setStep("request")}
                className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                &larr; Back
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          Remembered it?{" "}
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
