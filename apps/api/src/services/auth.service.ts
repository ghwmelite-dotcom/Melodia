import { ulid } from "ulidx";
import { LIMITS } from "@melodia/shared";
import { refreshTokenQueries } from "../db/queries.js";

// --- PBKDF2 Password Hashing ---

const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    KEY_LENGTH * 8
  );
  const saltB64 = uint8ToBase64(salt);
  const hashB64 = uint8ToBase64(new Uint8Array(derived));
  return `${saltB64}:${hashB64}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(":");
  if (!saltB64 || !hashB64) return false;
  const salt = base64ToUint8(saltB64);
  const expectedHash = base64ToUint8(hashB64);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
      key,
      KEY_LENGTH * 8
    )
  );
  return timingSafeEqual(derived, expectedHash);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

// --- JWT ---

export async function createAccessToken(
  userId: string,
  secret: string
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    iat: now,
    exp: now + LIMITS.ACCESS_TOKEN_EXPIRY_SECONDS,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
  const sigB64 = uint8ToBase64Url(sig);

  return `${headerB64}.${payloadB64}.${sigB64}`;
}

// --- Refresh Token ---

export function generateRefreshToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return uint8ToBase64Url(bytes);
}

export async function hashRefreshToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(hash)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function issueTokens(
  db: D1Database,
  userId: string,
  jwtSecret: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: string }> {
  const accessToken = await createAccessToken(userId, jwtSecret);
  const refreshToken = generateRefreshToken();
  const tokenHash = await hashRefreshToken(refreshToken);

  const expiresAt = new Date(
    Date.now() + LIMITS.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  await refreshTokenQueries.create(db, {
    id: ulid(),
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  return { accessToken, refreshToken, expiresAt };
}

export function refreshTokenCookie(
  refreshToken: string,
  expiresAt: string
): string {
  const expires = new Date(expiresAt).toUTCString();
  return `refresh_token=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Expires=${expires}`;
}

export function clearRefreshTokenCookie(): string {
  return "refresh_token=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0";
}

// --- Encoding Helpers ---

function uint8ToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToUint8(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function uint8ToBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
