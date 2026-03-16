import { ulid } from "ulidx";
import { LIMITS } from "@melodia/shared";
import { otpQueries } from "../db/queries.js";
import { AppError } from "../middleware/error-handler.js";
import type { Env } from "../types.js";

// --- OTP Code Generation ---

export function generateOtpCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const uint32 =
    ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return (uint32 % 1_000_000).toString().padStart(6, "0");
}

// --- Send OTP ---

export async function sendOtp(env: Env, phone: string): Promise<void> {
  // Rate limit: max OTP_RATE_LIMIT_PER_HOUR sends per phone per hour
  const rateLimitKey = `otp:rate:${phone}`;
  const current = await env.KV.get(rateLimitKey);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= LIMITS.OTP_RATE_LIMIT_PER_HOUR) {
    throw new AppError(
      "RATE_LIMITED",
      "Too many OTP requests. Please wait before requesting another code.",
      429
    );
  }

  // Always include TTL — KV put without TTL removes existing TTL (permanent lockout bug)
  await env.KV.put(rateLimitKey, String(count + 1), { expirationTtl: 3600 });

  // Invalidate any previous unused OTPs for this phone
  await otpQueries.invalidatePrevious(env.DB, phone);

  // Generate and store new OTP
  const code = generateOtpCode();
  const expiresAt = new Date(
    Date.now() + LIMITS.OTP_EXPIRY_MINUTES * 60 * 1000
  ).toISOString();

  await otpQueries.create(env.DB, {
    id: ulid(),
    phone,
    code,
    expires_at: expiresAt,
  });

  // Send SMS via Hubtel
  const credentials = btoa(
    `${env.HUBTEL_CLIENT_ID}:${env.HUBTEL_CLIENT_SECRET}`
  );

  const response = await fetch(
    "https://sms.hubtel.com/v1/messages/send",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        From: env.HUBTEL_SENDER_ID,
        To: phone,
        Content: `Your Melodia code: ${code}. Expires in ${LIMITS.OTP_EXPIRY_MINUTES} minutes.`,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("Hubtel SMS error:", response.status, text);
    throw new AppError("INTERNAL_ERROR", "Failed to send SMS. Please try again.", 500);
  }
}

// --- Verify OTP ---

export type OtpVerifyResult =
  | { success: true }
  | { success: false; reason: "not_found" | "max_attempts" | "invalid_code" };

export async function verifyOtp(
  db: D1Database,
  phone: string,
  code: string
): Promise<OtpVerifyResult> {
  const otp = (await otpQueries.findLatestValid(db, phone)) as {
    id: string;
    phone: string;
    code: string;
    attempts: number;
    used: number;
    expires_at: string;
    created_at: string;
  } | null;

  if (!otp) {
    return { success: false, reason: "not_found" };
  }

  if (otp.attempts >= LIMITS.OTP_MAX_ATTEMPTS) {
    return { success: false, reason: "max_attempts" };
  }

  // Increment attempts before checking code to prevent timing attacks
  await otpQueries.incrementAttempts(db, otp.id);

  if (otp.code !== code) {
    return { success: false, reason: "invalid_code" };
  }

  await otpQueries.markUsed(db, otp.id);
  return { success: true };
}
