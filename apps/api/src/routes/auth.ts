import { Hono } from "hono";
import { ulid } from "ulidx";
import * as v from "valibot";
import {
  RegisterSchema,
  LoginSchema,
  OtpSendSchema,
  OtpVerifySchema,
  ExchangeSchema,
  ResetRequestSchema,
  ResetConfirmSchema,
} from "@melodia/shared";
import type { Env, Variables } from "../types.js";
import { AppError } from "../middleware/error-handler.js";
import { authGuard } from "../middleware/auth.js";
import {
  hashPassword,
  verifyPassword,
  issueTokens,
  hashRefreshToken,
  refreshTokenCookie,
  clearRefreshTokenCookie,
} from "../services/auth.service.js";
import { sendOtp, verifyOtp } from "../services/otp.service.js";
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  fetchGoogleUser,
  getGoogleRedirectUri,
} from "../services/google.service.js";
import { userQueries, refreshTokenQueries } from "../db/queries.js";

type HonoContext = { Bindings: Env; Variables: Variables };

const auth = new Hono<HonoContext>();

// --- Helpers ---

function generateUsername(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `user_${hex}`;
}

type SafeUser = {
  id: string;
  email: string | null;
  phone: string | null;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  primary_auth_method: string;
  is_verified: number;
  created_at: string;
  updated_at: string;
};

function stripSensitiveFields(user: Record<string, unknown>): SafeUser {
  const { password_hash: _ph, google_id: _gi, ...safe } = user;
  return safe as SafeUser;
}

async function issueTokenResponse(
  c: { env: Env; header: (name: string, value: string) => void },
  user: Record<string, unknown>
): Promise<{ success: true; access_token: string; user: SafeUser }> {
  const userId = user.id as string;
  const { accessToken, refreshToken, expiresAt } = await issueTokens(
    c.env.DB,
    userId,
    c.env.JWT_SECRET
  );

  c.header("Set-Cookie", refreshTokenCookie(refreshToken, expiresAt));

  return {
    success: true,
    access_token: accessToken,
    user: stripSensitiveFields(user),
  };
}

// ============================================================
// PUBLIC ROUTES
// ============================================================

// POST /register
auth.post("/register", async (c) => {
  try {
    const body = await c.req.json().catch(() => {
      throw new AppError("VALIDATION_ERROR", "Invalid JSON body", 400);
    });

    const result = v.safeParse(RegisterSchema, body);
    if (!result.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        result.issues.map((i) => i.message).join(", "),
        400
      );
    }

    const { email, password, username } = result.output;

    const [existingEmail, existingUsername] = await Promise.all([
      userQueries.findByEmail(c.env.DB, email),
      userQueries.findByUsername(c.env.DB, username),
    ]);

    if (existingEmail) {
      throw new AppError("VALIDATION_ERROR", "Email is already in use.", 400);
    }
    if (existingUsername) {
      throw new AppError("VALIDATION_ERROR", "Username is already taken.", 400);
    }

    const passwordHash = await hashPassword(password);
    const id = ulid();

    await userQueries.create(c.env.DB, {
      id,
      email,
      username,
      password_hash: passwordHash,
      primary_auth_method: "email",
      is_verified: 0,
    });

    const user = await userQueries.findById(c.env.DB, id);
    if (!user) {
      throw new AppError("INTERNAL_ERROR", "Failed to create user.", 500);
    }

    const tokenResponse = await issueTokenResponse(c, user as Record<string, unknown>);
    return c.json(tokenResponse, 201);
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error("[register] Unhandled error:", err);
    throw new AppError("INTERNAL_ERROR", String(err), 500);
  }
});

// POST /login — rate limit by email (10/hour), limit checked inline before password verify
auth.post("/login", async (c) => {
  const body = await c.req.json().catch(() => {
    throw new AppError("VALIDATION_ERROR", "Invalid JSON body", 400);
  });

  const result = v.safeParse(LoginSchema, body);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      result.issues.map((i) => i.message).join(", "),
      400
    );
  }

  const { email, password } = result.output;

  // Rate limit by email — 10 attempts per hour
  const rateLimitKey = `rate:login:email:${email}`;
  const current = await c.env.KV.get(rateLimitKey);
  const attemptCount = current ? parseInt(current, 10) : 0;

  if (attemptCount >= 10) {
    throw new AppError(
      "RATE_LIMITED",
      "Too many login attempts for this email. Try again later.",
      429
    );
  }

  // Always include TTL — KV put without TTL removes existing TTL (permanent lockout bug)
  await c.env.KV.put(rateLimitKey, String(attemptCount + 1), { expirationTtl: 3600 });

  const user = (await userQueries.findByEmail(c.env.DB, email)) as Record<
    string,
    unknown
  > | null;

  if (!user || !user.password_hash) {
    throw new AppError("UNAUTHORIZED", "Invalid email or password.", 401);
  }

  const valid = await verifyPassword(password, user.password_hash as string);
  if (!valid) {
    throw new AppError("UNAUTHORIZED", "Invalid email or password.", 401);
  }

  return c.json(await issueTokenResponse(c, user));
});

// POST /otp/send
auth.post("/otp/send", async (c) => {
  const body = await c.req.json().catch(() => {
    throw new AppError("VALIDATION_ERROR", "Invalid JSON body", 400);
  });

  const result = v.safeParse(OtpSendSchema, body);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      result.issues.map((i) => i.message).join(", "),
      400
    );
  }

  await sendOtp(c.env, result.output.phone);

  return c.json({ success: true, message: "OTP sent successfully." });
});

// POST /otp/verify
auth.post("/otp/verify", async (c) => {
  const body = await c.req.json().catch(() => {
    throw new AppError("VALIDATION_ERROR", "Invalid JSON body", 400);
  });

  const result = v.safeParse(OtpVerifySchema, body);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      result.issues.map((i) => i.message).join(", "),
      400
    );
  }

  const { phone, code } = result.output;

  const verifyResult = await verifyOtp(c.env.DB, phone, code);
  if (!verifyResult.success) {
    const messages: Record<typeof verifyResult.reason, string> = {
      not_found: "No active OTP found for this phone number.",
      max_attempts: "Maximum OTP attempts exceeded. Please request a new code.",
      invalid_code: "Invalid OTP code.",
    };
    throw new AppError("UNAUTHORIZED", messages[verifyResult.reason], 401);
  }

  // Find or create user by phone
  let user = (await userQueries.findByPhone(c.env.DB, phone)) as Record<
    string,
    unknown
  > | null;

  if (!user) {
    const id = ulid();
    const username = generateUsername();
    await userQueries.create(c.env.DB, {
      id,
      phone,
      username,
      primary_auth_method: "phone",
      is_verified: 1,
    });
    user = (await userQueries.findById(c.env.DB, id)) as Record<
      string,
      unknown
    >;
  }

  if (!user) {
    throw new AppError("INTERNAL_ERROR", "Failed to create or find user.", 500);
  }

  return c.json(await issueTokenResponse(c, user));
});

// GET /google — initiate OAuth flow
auth.get("/google", async (c) => {
  const state = crypto.randomUUID();
  await c.env.KV.put(`oauth:state:${state}`, "1", { expirationTtl: 600 });

  const origin = new URL(c.req.url).origin;
  const redirectUri = getGoogleRedirectUri(origin);
  const authUrl = buildGoogleAuthUrl(c.env, redirectUri, state);

  return c.redirect(authUrl, 302);
});

// GET /google/callback
auth.get("/google/callback", async (c) => {
  const { code, state, error } = c.req.query();

  if (error) {
    throw new AppError("UNAUTHORIZED", `Google OAuth error: ${error}`, 401);
  }

  if (!state || !code) {
    throw new AppError("VALIDATION_ERROR", "Missing state or code parameter.", 400);
  }

  // Validate state from KV
  const stateKey = `oauth:state:${state}`;
  const storedState = await c.env.KV.get(stateKey);
  if (!storedState) {
    throw new AppError("UNAUTHORIZED", "Invalid or expired OAuth state.", 401);
  }
  await c.env.KV.delete(stateKey);

  // Exchange code for tokens
  const origin = new URL(c.req.url).origin;
  const redirectUri = getGoogleRedirectUri(origin);
  const tokens = await exchangeGoogleCode(c.env, code, redirectUri);

  // Fetch Google user info
  const googleUser = await fetchGoogleUser(tokens.access_token);

  // Find or create user with account linking
  let user = (await userQueries.findByGoogleId(
    c.env.DB,
    googleUser.sub
  )) as Record<string, unknown> | null;

  if (!user && googleUser.email) {
    // Check if email already exists — auto-link
    const existingByEmail = (await userQueries.findByEmail(
      c.env.DB,
      googleUser.email
    )) as Record<string, unknown> | null;

    if (existingByEmail) {
      await userQueries.linkGoogleId(
        c.env.DB,
        existingByEmail.id as string,
        googleUser.sub
      );
      user = (await userQueries.findById(
        c.env.DB,
        existingByEmail.id as string
      )) as Record<string, unknown>;
    }
  }

  if (!user) {
    const id = ulid();
    const username = generateUsername();
    await userQueries.create(c.env.DB, {
      id,
      email: googleUser.email || null,
      username,
      display_name: googleUser.name || null,
      avatar_url: googleUser.picture || null,
      google_id: googleUser.sub,
      primary_auth_method: "google",
      is_verified: googleUser.email_verified ? 1 : 0,
    });
    user = (await userQueries.findById(c.env.DB, id)) as Record<
      string,
      unknown
    >;
  }

  if (!user) {
    throw new AppError("INTERNAL_ERROR", "Failed to create or find user.", 500);
  }

  // Generate a one-time exchange code, store user ID in KV (60s TTL)
  const exchangeCode = crypto.randomUUID();
  await c.env.KV.put(
    `oauth:exchange:${exchangeCode}`,
    user.id as string,
    { expirationTtl: 60 }
  );

  // Redirect to frontend with the one-time code
  const frontendOrigin =
    c.env.CORS_ORIGIN || origin.replace("/api", "");
  return c.redirect(
    `${frontendOrigin}/auth/callback?code=${exchangeCode}`,
    302
  );
});

// POST /exchange — trade one-time code for tokens
auth.post("/exchange", async (c) => {
  const body = await c.req.json().catch(() => {
    throw new AppError("VALIDATION_ERROR", "Invalid JSON body", 400);
  });

  const result = v.safeParse(ExchangeSchema, body);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      result.issues.map((i) => i.message).join(", "),
      400
    );
  }

  const { code } = result.output;
  const kvKey = `oauth:exchange:${code}`;
  const userId = await c.env.KV.get(kvKey);

  if (!userId) {
    throw new AppError("UNAUTHORIZED", "Invalid or expired exchange code.", 401);
  }

  // Consume the one-time code immediately
  await c.env.KV.delete(kvKey);

  const user = (await userQueries.findById(c.env.DB, userId)) as Record<
    string,
    unknown
  > | null;
  if (!user) {
    throw new AppError("NOT_FOUND", "User not found.", 404);
  }

  return c.json(await issueTokenResponse(c, user));
});

// POST /refresh
auth.post("/refresh", async (c) => {
  const cookieHeader = c.req.header("Cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)refresh_token=([^;]+)/);
  const rawToken = match?.[1];

  if (!rawToken) {
    throw new AppError("UNAUTHORIZED", "No refresh token provided.", 401);
  }

  const tokenHash = await hashRefreshToken(rawToken);
  const storedToken = (await refreshTokenQueries.findByHash(
    c.env.DB,
    tokenHash
  )) as {
    id: string;
    user_id: string;
    expires_at: string;
    revoked: number;
  } | null;

  if (!storedToken) {
    throw new AppError("UNAUTHORIZED", "Invalid or revoked refresh token.", 401);
  }

  if (new Date(storedToken.expires_at) < new Date()) {
    throw new AppError("UNAUTHORIZED", "Refresh token has expired.", 401);
  }

  // Revoke old token (rotation)
  await refreshTokenQueries.revoke(c.env.DB, storedToken.id);

  const user = (await userQueries.findById(
    c.env.DB,
    storedToken.user_id
  )) as Record<string, unknown> | null;
  if (!user) {
    throw new AppError("NOT_FOUND", "User not found.", 404);
  }

  return c.json(await issueTokenResponse(c, user));
});

// POST /reset-password/request
auth.post("/reset-password/request", async (c) => {
  const body = await c.req.json().catch(() => {
    throw new AppError("VALIDATION_ERROR", "Invalid JSON body", 400);
  });

  const result = v.safeParse(ResetRequestSchema, body);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      result.issues.map((i) => i.message).join(", "),
      400
    );
  }

  const { email } = result.output;
  const user = (await userQueries.findByEmail(c.env.DB, email)) as {
    id: string;
    phone: string | null;
  } | null;

  // Always return generic message to prevent email enumeration
  if (user?.phone) {
    // Fire and forget — don't await to avoid timing leak, but log errors
    sendOtp(c.env, user.phone).catch((err) =>
      console.error("Reset OTP send error:", err)
    );
  }

  return c.json({
    success: true,
    message:
      "If an account with that email exists and has a phone number, an OTP has been sent.",
  });
});

// POST /reset-password/confirm
auth.post("/reset-password/confirm", async (c) => {
  const body = await c.req.json().catch(() => {
    throw new AppError("VALIDATION_ERROR", "Invalid JSON body", 400);
  });

  const result = v.safeParse(ResetConfirmSchema, body);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      result.issues.map((i) => i.message).join(", "),
      400
    );
  }

  const { email, code, new_password } = result.output;

  const user = (await userQueries.findByEmail(c.env.DB, email)) as {
    id: string;
    phone: string | null;
  } | null;

  if (!user || !user.phone) {
    throw new AppError(
      "UNAUTHORIZED",
      "Unable to reset password for this account.",
      401
    );
  }

  const verifyResult = await verifyOtp(c.env.DB, user.phone, code);
  if (!verifyResult.success) {
    const messages: Record<typeof verifyResult.reason, string> = {
      not_found: "No active OTP found.",
      max_attempts: "Maximum OTP attempts exceeded. Please request a new code.",
      invalid_code: "Invalid OTP code.",
    };
    throw new AppError("UNAUTHORIZED", messages[verifyResult.reason], 401);
  }

  const newHash = await hashPassword(new_password);

  // Revoke all refresh tokens and update password atomically
  await Promise.all([
    userQueries.updatePasswordHash(c.env.DB, user.id, newHash),
    refreshTokenQueries.revokeAllForUser(c.env.DB, user.id),
  ]);

  const freshUser = (await userQueries.findById(c.env.DB, user.id)) as Record<
    string,
    unknown
  > | null;
  if (!freshUser) {
    throw new AppError("INTERNAL_ERROR", "Failed to load user after reset.", 500);
  }

  return c.json(await issueTokenResponse(c, freshUser));
});

// ============================================================
// PROTECTED ROUTES
// ============================================================

auth.use("/me", authGuard());
auth.use("/logout", authGuard());

// GET /me
auth.get("/me", async (c) => {
  const userId = c.get("userId");
  const user = (await userQueries.findById(c.env.DB, userId)) as Record<
    string,
    unknown
  > | null;

  if (!user) {
    throw new AppError("NOT_FOUND", "User not found.", 404);
  }

  return c.json({ success: true, user: stripSensitiveFields(user) });
});

// POST /logout
auth.post("/logout", async (c) => {
  const cookieHeader = c.req.header("Cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)refresh_token=([^;]+)/);
  const rawToken = match?.[1];

  if (rawToken) {
    const tokenHash = await hashRefreshToken(rawToken);
    const storedToken = (await refreshTokenQueries.findByHash(
      c.env.DB,
      tokenHash
    )) as { id: string } | null;

    if (storedToken) {
      await refreshTokenQueries.revoke(c.env.DB, storedToken.id);
    }
  }

  c.header("Set-Cookie", clearRefreshTokenCookie());
  return c.json({ success: true, message: "Logged out successfully." });
});

export { auth };
