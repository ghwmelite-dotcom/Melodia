import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import type { User } from "@melodia/shared";

const CODE_LENGTH = 6;

interface OtpVerifyResponse {
  access_token: string;
  user: User;
}

export default function VerifyOtp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const phone = searchParams.get("phone") ?? "";
  const { login } = useAuth();
  const verifyApi = useApi<OtpVerifyResponse>();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Auto-submit when all digits filled
  useEffect(() => {
    const code = digits.join("");
    if (code.length === CODE_LENGTH && digits.every((d) => d !== "")) {
      void submitCode(code);
    }
  }, [digits]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitCode(code: string) {
    const data = await verifyApi.call(() =>
      api.post<OtpVerifyResponse>("/api/auth/otp/verify", { phone, code })
    );
    if (data) {
      login(data.access_token, data.user);
      void navigate("/dashboard");
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (digits[index] !== "") {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
      }
    }
  }

  function handleChange(index: number, value: string) {
    // Allow pasting full code
    if (value.length > 1) {
      const cleaned = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
      const next = [...digits];
      for (let i = 0; i < cleaned.length; i++) {
        next[index + i] = cleaned[i] ?? "";
      }
      setDigits(next);
      const nextFocus = Math.min(index + cleaned.length, CODE_LENGTH - 1);
      inputRefs.current[nextFocus]?.focus();
      return;
    }

    const digit = value.replace(/\D/g, "");
    if (!digit) return;

    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    if (index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  const maskedPhone = phone
    ? phone.slice(0, 5) + "•".repeat(Math.max(0, phone.length - 8)) + phone.slice(-3)
    : "your phone";

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
          <h2 className="mt-4 text-xl font-semibold text-white">Check your messages</h2>
          <p className="mt-2 text-sm text-gray-400">
            We sent a 6-digit code to{" "}
            <span className="text-gray-300 font-medium">{maskedPhone}</span>
          </p>
        </div>

        <div
          className="rounded-2xl p-6 border"
          style={{
            backgroundColor: "var(--color-surface-1)",
            borderColor: "var(--color-surface-3)",
          }}
        >
          {verifyApi.error && (
            <p
              className="text-sm px-3 py-2 rounded-lg mb-4"
              style={{
                color: "var(--color-coral)",
                backgroundColor: "rgba(231, 76, 60, 0.1)",
              }}
            >
              {verifyApi.error}
            </p>
          )}

          {/* OTP boxes */}
          <div className="flex gap-2 justify-center mb-6">
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={6} // allow paste
                value={digits[i]}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-11 h-12 text-center text-lg font-semibold text-white rounded-xl outline-none transition-all"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  border: digits[i]
                    ? "2px solid var(--color-amber)"
                    : "1px solid var(--color-surface-3)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--color-amber)";
                  e.target.style.boxShadow = "0 0 0 2px rgba(240, 165, 0, 0.2)";
                }}
                onBlur={(e) => {
                  if (!digits[i]) {
                    e.target.style.borderColor = "var(--color-surface-3)";
                    e.target.style.boxShadow = "none";
                  }
                }}
                disabled={verifyApi.loading}
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={() => void submitCode(digits.join(""))}
            disabled={verifyApi.loading || digits.some((d) => !d)}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-black transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            style={{ backgroundColor: "var(--color-amber)" }}
          >
            {verifyApi.loading ? "Verifying…" : "Verify Code"}
          </button>

          <p className="text-center mt-4 text-sm text-gray-500">
            Didn't receive a code?{" "}
            <Link
              to="/login"
              className="hover:underline"
              style={{ color: "var(--color-amber)" }}
            >
              Try again
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
