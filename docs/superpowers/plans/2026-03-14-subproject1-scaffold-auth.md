# Sub-project 1: Scaffold, Database & Auth — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Melodia monorepo foundation with D1 schema, three auth flows (email/password, phone OTP, Google OAuth), API middleware, and React frontend shell.

**Architecture:** Monorepo with npm workspaces — `apps/api` (Hono on Cloudflare Workers), `apps/web` (Vite + React), `packages/shared` (Valibot schemas + constants). Auth produces JWT access tokens (15min) + refresh tokens (7d httpOnly cookie). All validation shared between API and frontend via Valibot schemas.

**Tech Stack:** TypeScript strict, Hono, Vite, React 19, React Router 7, Tailwind CSS 4, Valibot, ulidx, Cloudflare Workers/D1/KV, Web Crypto API (PBKDF2), Hubtel SMS API, Google OAuth 2.0

**Spec:** `docs/superpowers/specs/2026-03-14-melodia-subproject1-scaffold-auth-design.md`

---

## Chunk 1: Monorepo Scaffold & Shared Package

### Task 1: Root Monorepo Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

- [ ] **Step 1: Create root package.json with workspaces**

```json
{
  "name": "melodia",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev:api": "npm run dev -w apps/api",
    "dev:web": "npm run dev -w apps/web",
    "build:api": "npm run build -w apps/api",
    "build:web": "npm run build -w apps/web",
    "build:shared": "npm run build -w packages/shared",
    "typecheck": "tsc -b"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
.wrangler/
.dev.vars
.env
.env.local
*.log
.DS_Store
.turbo
```

- [ ] **Step 4: Commit**

```bash
git add package.json tsconfig.base.json .gitignore
git commit -m "chore: initialize monorepo with npm workspaces"
```

---

### Task 2: Shared Package — Constants & Valibot Schemas

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/schemas/auth.ts`
- Create: `packages/shared/src/schemas/user.ts`
- Create: `packages/shared/src/schemas/song.ts`
- Create: `packages/shared/src/schemas/playlist.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create packages/shared/package.json**

```json
{
  "name": "@melodia/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "valibot": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/shared/src/constants.ts**

```typescript
// Plans
export const PLANS = ["free", "creator", "pro", "enterprise"] as const;
export type Plan = (typeof PLANS)[number];

// Song statuses
export const SONG_STATUSES = [
  "pending",
  "generating_lyrics",
  "generating_music",
  "generating_artwork",
  "processing",
  "completed",
  "failed",
] as const;
export type SongStatus = (typeof SONG_STATUSES)[number];

// Auth methods
export const AUTH_METHODS = ["email", "phone", "google"] as const;
export type AuthMethod = (typeof AUTH_METHODS)[number];

// Credit reasons
export const CREDIT_REASONS = [
  "song_generation",
  "daily_reset",
  "purchase",
  "referral",
  "signup_bonus",
] as const;
export type CreditReason = (typeof CREDIT_REASONS)[number];

// Limits
export const LIMITS = {
  FREE_CREDITS_PER_DAY: 5,
  OTP_MAX_ATTEMPTS: 3,
  OTP_EXPIRY_MINUTES: 5,
  OTP_RATE_LIMIT_PER_HOUR: 3,
  LOGIN_RATE_LIMIT_PER_HOUR: 10,
  ACCESS_TOKEN_EXPIRY_SECONDS: 15 * 60,
  REFRESH_TOKEN_EXPIRY_DAYS: 7,
  PASSWORD_MIN_LENGTH: 8,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 20,
} as const;

// Genres (for dropdowns and validation)
export const GENRES = [
  "afrobeats",
  "afro-fusion",
  "afro-soul",
  "highlife",
  "hiplife",
  "hip-hop",
  "rap",
  "r&b",
  "soul",
  "pop",
  "edm",
  "electronic",
  "dancehall",
  "reggae",
  "gospel",
  "worship",
  "jazz",
  "blues",
  "country",
  "folk",
  "rock",
  "alternative",
  "classical",
  "lo-fi",
  "trap",
  "drill",
  "amapiano",
  "kizomba",
  "zouk",
  "afro-house",
] as const;
export type Genre = (typeof GENRES)[number];

// Error codes
export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "NOT_IMPLEMENTED",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
```

- [ ] **Step 4: Create packages/shared/src/schemas/auth.ts**

```typescript
import * as v from "valibot";
import { LIMITS } from "../constants.js";

// Email + password registration
export const RegisterSchema = v.object({
  email: v.pipe(v.string(), v.email(), v.maxLength(255)),
  password: v.pipe(v.string(), v.minLength(LIMITS.PASSWORD_MIN_LENGTH)),
  username: v.pipe(
    v.string(),
    v.minLength(LIMITS.USERNAME_MIN_LENGTH),
    v.maxLength(LIMITS.USERNAME_MAX_LENGTH),
    v.regex(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric or underscore")
  ),
});
export type RegisterInput = v.InferInput<typeof RegisterSchema>;

// Email + password login
export const LoginSchema = v.object({
  email: v.pipe(v.string(), v.email()),
  password: v.pipe(v.string(), v.minLength(1)),
});
export type LoginInput = v.InferInput<typeof LoginSchema>;

// Phone OTP send
export const OtpSendSchema = v.object({
  phone: v.pipe(
    v.string(),
    v.regex(/^\+233\d{9}$/, "Phone must be in format +233XXXXXXXXX")
  ),
});
export type OtpSendInput = v.InferInput<typeof OtpSendSchema>;

// Phone OTP verify
export const OtpVerifySchema = v.object({
  phone: v.pipe(
    v.string(),
    v.regex(/^\+233\d{9}$/, "Phone must be in format +233XXXXXXXXX")
  ),
  code: v.pipe(v.string(), v.regex(/^\d{6}$/, "Code must be 6 digits")),
});
export type OtpVerifyInput = v.InferInput<typeof OtpVerifySchema>;

// Google OAuth code exchange
export const ExchangeSchema = v.object({
  code: v.pipe(v.string(), v.minLength(1)),
});
export type ExchangeInput = v.InferInput<typeof ExchangeSchema>;

// Password reset request
export const ResetRequestSchema = v.object({
  email: v.pipe(v.string(), v.email()),
});
export type ResetRequestInput = v.InferInput<typeof ResetRequestSchema>;

// Password reset confirm
export const ResetConfirmSchema = v.object({
  email: v.pipe(v.string(), v.email()),
  code: v.pipe(v.string(), v.regex(/^\d{6}$/, "Code must be 6 digits")),
  new_password: v.pipe(v.string(), v.minLength(LIMITS.PASSWORD_MIN_LENGTH)),
});
export type ResetConfirmInput = v.InferInput<typeof ResetConfirmSchema>;

// Profile update
export const UpdateProfileSchema = v.object({
  username: v.optional(
    v.pipe(
      v.string(),
      v.minLength(LIMITS.USERNAME_MIN_LENGTH),
      v.maxLength(LIMITS.USERNAME_MAX_LENGTH),
      v.regex(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric or underscore")
    )
  ),
  display_name: v.optional(v.pipe(v.string(), v.maxLength(100))),
});
export type UpdateProfileInput = v.InferInput<typeof UpdateProfileSchema>;
```

- [ ] **Step 5: Create packages/shared/src/schemas/user.ts**

```typescript
import * as v from "valibot";
import { PLANS, AUTH_METHODS } from "../constants.js";

export const UserSchema = v.object({
  id: v.string(),
  email: v.nullable(v.string()),
  phone: v.nullable(v.string()),
  username: v.string(),
  display_name: v.nullable(v.string()),
  avatar_url: v.nullable(v.string()),
  plan: v.picklist(PLANS),
  primary_auth_method: v.picklist(AUTH_METHODS),
  credits_remaining: v.number(),
  is_verified: v.boolean(),
  created_at: v.string(),
});
export type User = v.InferOutput<typeof UserSchema>;
```

- [ ] **Step 6: Create packages/shared/src/schemas/song.ts**

```typescript
import * as v from "valibot";
import { SONG_STATUSES } from "../constants.js";

export const SongSchema = v.object({
  id: v.string(),
  user_id: v.string(),
  title: v.string(),
  status: v.picklist(SONG_STATUSES),
  user_prompt: v.string(),
  genre: v.nullable(v.string()),
  sub_genre: v.nullable(v.string()),
  mood: v.nullable(v.string()),
  bpm: v.nullable(v.number()),
  duration_seconds: v.number(),
  audio_url: v.nullable(v.string()),
  artwork_url: v.nullable(v.string()),
  is_public: v.boolean(),
  play_count: v.number(),
  like_count: v.number(),
  created_at: v.string(),
});
export type Song = v.InferOutput<typeof SongSchema>;
```

- [ ] **Step 7: Create packages/shared/src/schemas/playlist.ts**

```typescript
import * as v from "valibot";

export const CreatePlaylistSchema = v.object({
  title: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  description: v.optional(v.pipe(v.string(), v.maxLength(500))),
});
export type CreatePlaylistInput = v.InferInput<typeof CreatePlaylistSchema>;
```

- [ ] **Step 8: Create packages/shared/src/index.ts**

```typescript
export * from "./constants.js";
export * from "./schemas/auth.js";
export * from "./schemas/user.js";
export * from "./schemas/song.js";
export * from "./schemas/playlist.js";
```

- [ ] **Step 9: Install dependencies and verify typecheck**

```bash
npm install
npm run typecheck -w packages/shared
```

Expected: No type errors.

- [ ] **Step 10: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared package with Valibot schemas and constants"
```

---

## Chunk 2: API Scaffold — Hono, D1 Schema, Middleware

### Task 3: API Package Setup & Wrangler Config

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/wrangler.toml`
- Create: `apps/api/src/types.ts`

- [ ] **Step 1: Create apps/api/package.json**

```json
{
  "name": "@melodia/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit",
    "db:migrate:local": "wrangler d1 execute melodia-db --local --file=src/db/schema.sql",
    "db:migrate:remote": "wrangler d1 execute melodia-db --remote --file=src/db/schema.sql"
  },
  "dependencies": {
    "@melodia/shared": "*",
    "hono": "^4.7.0",
    "ulidx": "^2.4.0",
    "valibot": "^1.0.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250310.0",
    "typescript": "^5.7.0",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create apps/api/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["@cloudflare/workers-types"],
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "paths": {
      "@melodia/shared": ["../../packages/shared/src"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "../../packages/shared" }]
}
```

- [ ] **Step 3: Create apps/api/wrangler.toml**

```toml
name = "melodia-api"
main = "src/index.ts"
compatibility_date = "2025-12-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "melodia-db"
database_id = "local"

[[kv_namespaces]]
binding = "KV"
id = "local"

[vars]
ENVIRONMENT = "development"
CORS_ORIGIN = "http://localhost:5173"
MAX_FREE_SONGS_PER_DAY = "5"
```

- [ ] **Step 4: Create apps/api/src/types.ts**

```typescript
export type Env = {
  // Active in Sub-project 1
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
  HUBTEL_CLIENT_ID: string;
  HUBTEL_CLIENT_SECRET: string;
  HUBTEL_SENDER_ID: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  ENVIRONMENT: string;
  CORS_ORIGIN: string;
  MAX_FREE_SONGS_PER_DAY: string;

  // Forward-declared for Sub-project 2+ (not bound in wrangler.toml yet)
  R2_BUCKET: R2Bucket;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  SONG_SESSION: DurableObjectNamespace;
  GENERATION_QUEUE: Queue;
  ACE_STEP_API_URL: string;
  ACE_STEP_API_KEY: string;
};

// Hono context variables set by middleware
export type Variables = {
  userId: string;
};
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/tsconfig.json apps/api/wrangler.toml apps/api/src/types.ts
git commit -m "chore: add API package with wrangler config and env types"
```

---

### Task 4: D1 Database Schema

**Files:**
- Create: `apps/api/src/db/schema.sql`

- [ ] **Step 1: Create the full D1 schema**

Write the complete SQL from spec Sections 4.1–4.6 into `apps/api/src/db/schema.sql`. All tables, all indexes. This is a direct copy from the spec.

- [ ] **Step 2: Verify schema loads locally**

```bash
cd apps/api
npx wrangler d1 execute melodia-db --local --file=src/db/schema.sql
```

Expected: No SQL errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/schema.sql
git commit -m "feat: add full D1 database schema"
```

---

### Task 5: Database Query Helpers

**Files:**
- Create: `apps/api/src/db/queries.ts`

- [ ] **Step 1: Create prepared statement helpers**

```typescript
import type { D1Database } from "@cloudflare/workers-types";

// All queries use prepared statements — never string concatenation.
// Booleans use 0/1 (D1/SQLite). All UPDATEs set updated_at.

export const userQueries = {
  findByEmail: (db: D1Database, email: string) =>
    db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first(),

  findByPhone: (db: D1Database, phone: string) =>
    db.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first(),

  findByGoogleId: (db: D1Database, googleId: string) =>
    db.prepare("SELECT * FROM users WHERE google_id = ?").bind(googleId).first(),

  findById: (db: D1Database, id: string) =>
    db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first(),

  findByUsername: (db: D1Database, username: string) =>
    db.prepare("SELECT * FROM users WHERE username = ?").bind(username).first(),

  create: (
    db: D1Database,
    user: {
      id: string;
      email?: string | null;
      phone?: string | null;
      username: string;
      display_name?: string | null;
      avatar_url?: string | null;
      password_hash?: string | null;
      google_id?: string | null;
      primary_auth_method: string;
      is_verified: number;
    }
  ) =>
    db
      .prepare(
        `INSERT INTO users (id, email, phone, username, display_name, avatar_url, password_hash, google_id, primary_auth_method, is_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        user.id,
        user.email ?? null,
        user.phone ?? null,
        user.username,
        user.display_name ?? null,
        user.avatar_url ?? null,
        user.password_hash ?? null,
        user.google_id ?? null,
        user.primary_auth_method,
        user.is_verified
      )
      .run(),

  updateProfile: (
    db: D1Database,
    id: string,
    fields: { username?: string; display_name?: string }
  ) => {
    const sets: string[] = ["updated_at = datetime('now')"];
    const values: (string | null)[] = [];
    if (fields.username !== undefined) {
      sets.push("username = ?");
      values.push(fields.username);
    }
    if (fields.display_name !== undefined) {
      sets.push("display_name = ?");
      values.push(fields.display_name);
    }
    values.push(id);
    return db
      .prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  },

  linkGoogleId: (db: D1Database, userId: string, googleId: string) =>
    db
      .prepare(
        "UPDATE users SET google_id = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(googleId, userId)
      .run(),

  updatePasswordHash: (db: D1Database, userId: string, hash: string) =>
    db
      .prepare(
        "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(hash, userId)
      .run(),
};

export const otpQueries = {
  create: (
    db: D1Database,
    otp: { id: string; phone: string; code: string; expires_at: string }
  ) =>
    db
      .prepare(
        "INSERT INTO otp_codes (id, phone, code, expires_at) VALUES (?, ?, ?, ?)"
      )
      .bind(otp.id, otp.phone, otp.code, otp.expires_at)
      .run(),

  invalidatePrevious: (db: D1Database, phone: string) =>
    db
      .prepare("UPDATE otp_codes SET used = 1 WHERE phone = ? AND used = 0")
      .bind(phone)
      .run(),

  findLatestValid: (db: D1Database, phone: string) =>
    db
      .prepare(
        `SELECT * FROM otp_codes
         WHERE phone = ? AND used = 0 AND expires_at > datetime('now')
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(phone)
      .first(),

  incrementAttempts: (db: D1Database, id: string) =>
    db
      .prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?")
      .bind(id)
      .run(),

  markUsed: (db: D1Database, id: string) =>
    db.prepare("UPDATE otp_codes SET used = 1 WHERE id = ?").bind(id).run(),
};

export const refreshTokenQueries = {
  create: (
    db: D1Database,
    token: { id: string; user_id: string; token_hash: string; expires_at: string }
  ) =>
    db
      .prepare(
        "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)"
      )
      .bind(token.id, token.user_id, token.token_hash, token.expires_at)
      .run(),

  findByHash: (db: D1Database, tokenHash: string) =>
    db
      .prepare(
        "SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0"
      )
      .bind(tokenHash)
      .first(),

  revoke: (db: D1Database, id: string) =>
    db
      .prepare("UPDATE refresh_tokens SET revoked = 1 WHERE id = ?")
      .bind(id)
      .run(),

  revokeAllForUser: (db: D1Database, userId: string) =>
    db
      .prepare(
        "UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ? AND revoked = 0"
      )
      .bind(userId)
      .run(),
};

export const creditQueries = {
  getBalance: (db: D1Database, userId: string) =>
    db
      .prepare("SELECT credits_remaining, credits_reset_at FROM users WHERE id = ?")
      .bind(userId)
      .first(),

  getHistory: (db: D1Database, userId: string, limit = 50, offset = 0) =>
    db
      .prepare(
        "SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
      )
      .bind(userId, limit, offset)
      .all(),
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/db/queries.ts
git commit -m "feat: add D1 prepared statement query helpers"
```

---

### Task 6: API Middleware Stack

**Files:**
- Create: `apps/api/src/middleware/cors.ts`
- Create: `apps/api/src/middleware/error-handler.ts`
- Create: `apps/api/src/middleware/rate-limit.ts`
- Create: `apps/api/src/middleware/auth.ts`

- [ ] **Step 1: Create CORS middleware**

```typescript
import { cors } from "hono/cors";
import type { Env } from "../types.js";

export function corsMiddleware(corsOrigin: string) {
  const origins = corsOrigin.split(",").map((o) => o.trim());
  return cors({
    origin: origins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400,
  });
}
```

- [ ] **Step 2: Create error handler middleware**

```typescript
import type { ErrorCode } from "@melodia/shared";
import type { Context } from "hono";
import type { Env, Variables } from "../types.js";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number = 400
  ) {
    super(message);
  }
}

const STATUS_MAP: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  NOT_IMPLEMENTED: 501,
};

export function errorResponse(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  code: ErrorCode,
  message: string
) {
  return c.json(
    { success: false, error: { code, message } },
    STATUS_MAP[code] ?? 500
  );
}

export function errorHandler() {
  return async (
    c: Context<{ Bindings: Env; Variables: Variables }>,
    next: () => Promise<void>
  ) => {
    try {
      await next();
    } catch (err) {
      if (err instanceof AppError) {
        return errorResponse(c, err.code, err.message);
      }
      console.error("Unhandled error:", err);
      return errorResponse(c, "INTERNAL_ERROR", "An unexpected error occurred");
    }
  };
}
```

- [ ] **Step 3: Create rate limiter middleware**

```typescript
import type { Context, Next } from "hono";
import type { Env, Variables } from "../types.js";
import { AppError } from "./error-handler.js";

type RateLimitConfig = {
  key: (c: Context<{ Bindings: Env; Variables: Variables }>) => string;
  limit: number;
  windowSeconds: number;
};

export function rateLimit(config: RateLimitConfig) {
  return async (
    c: Context<{ Bindings: Env; Variables: Variables }>,
    next: Next
  ) => {
    const key = config.key(c);
    const kvKey = `rate:${key}`;
    const current = await c.env.KV.get(kvKey);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= config.limit) {
      throw new AppError("RATE_LIMITED", "Too many requests, try again later", 429);
    }

    // Only set TTL on the first request in the window.
    // Subsequent increments preserve the existing TTL so the window
    // expires naturally instead of resetting on every request.
    if (count === 0) {
      await c.env.KV.put(kvKey, "1", {
        expirationTtl: config.windowSeconds,
      });
    } else {
      await c.env.KV.put(kvKey, String(count + 1));
    }

    await next();
  };
}
```

- [ ] **Step 4: Create auth middleware**

```typescript
import type { Context, Next } from "hono";
import type { Env, Variables } from "../types.js";
import { AppError } from "./error-handler.js";

export function authGuard() {
  return async (
    c: Context<{ Bindings: Env; Variables: Variables }>,
    next: Next
  ) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError("UNAUTHORIZED", "Missing or invalid authorization header", 401);
    }

    const token = authHeader.slice(7);

    try {
      // Import key
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(c.env.JWT_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );

      // Decode JWT
      const [headerB64, payloadB64, signatureB64] = token.split(".");
      if (!headerB64 || !payloadB64 || !signatureB64) {
        throw new Error("Invalid token format");
      }

      // Verify signature
      const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
      const signature = base64UrlDecode(signatureB64);
      const valid = await crypto.subtle.verify("HMAC", key, signature, data);
      if (!valid) throw new Error("Invalid signature");

      // Parse payload
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));

      // Check expiry
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error("Token expired");
      }

      c.set("userId", payload.sub);
      await next();
    } catch {
      throw new AppError("UNAUTHORIZED", "Invalid or expired token", 401);
    }
  };
}

function base64UrlDecode(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/middleware/
git commit -m "feat: add API middleware — CORS, error handler, rate limiter, auth guard"
```

---

### Task 7: Auth Service — Password Hashing, JWT, Token Management

**Files:**
- Create: `apps/api/src/services/auth.service.ts`

- [ ] **Step 1: Create auth service**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/services/auth.service.ts
git commit -m "feat: add auth service — PBKDF2 hashing, JWT, refresh token management"
```

---

## Chunk 3: Auth Routes — Email/Password, OTP, Google OAuth

### Task 8: OTP Service (Hubtel Integration)

**Files:**
- Create: `apps/api/src/services/otp.service.ts`

- [ ] **Step 1: Create OTP service**

```typescript
import { ulid } from "ulidx";
import { LIMITS } from "@melodia/shared";
import { otpQueries } from "../db/queries.js";
import type { Env } from "../types.js";

export function generateOtpCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const num = (bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3]) >>> 0;
  return String(num % 1_000_000).padStart(6, "0");
}

export async function sendOtp(
  env: Env,
  phone: string
): Promise<void> {
  // Rate limit check
  const rateLimitKey = `rate:otp:${phone}`;
  const current = await env.KV.get(rateLimitKey);
  const count = current ? parseInt(current, 10) : 0;
  if (count >= LIMITS.OTP_RATE_LIMIT_PER_HOUR) {
    throw new Error("Too many OTP requests. Try again in an hour.");
  }

  // Invalidate previous unused OTPs for this phone
  await otpQueries.invalidatePrevious(env.DB, phone);

  // Generate and store OTP
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

  // Increment rate limit — only set TTL on first request in window
  if (count === 0) {
    await env.KV.put(rateLimitKey, "1", { expirationTtl: 3600 });
  } else {
    await env.KV.put(rateLimitKey, String(count + 1));
  }

  // Send SMS via Hubtel
  const credentials = btoa(`${env.HUBTEL_CLIENT_ID}:${env.HUBTEL_CLIENT_SECRET}`);
  const response = await fetch("https://sms.hubtel.com/v1/messages/send", {
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
  });

  if (!response.ok) {
    console.error("Hubtel SMS error:", await response.text());
    throw new Error("Failed to send OTP. Please try again.");
  }
}

export async function verifyOtp(
  db: D1Database,
  phone: string,
  code: string
): Promise<boolean> {
  const otp = await otpQueries.findLatestValid(db, phone);
  if (!otp) return false;

  // Check attempts
  if ((otp as any).attempts >= LIMITS.OTP_MAX_ATTEMPTS) return false;

  // Increment attempts
  await otpQueries.incrementAttempts(db, (otp as any).id);

  // Check code
  if ((otp as any).code !== code) return false;

  // Mark as used
  await otpQueries.markUsed(db, (otp as any).id);
  return true;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/services/otp.service.ts
git commit -m "feat: add OTP service with Hubtel SMS integration"
```

---

### Task 9: Google OAuth Service

**Files:**
- Create: `apps/api/src/services/google.service.ts`

- [ ] **Step 1: Create Google OAuth service**

```typescript
import type { Env } from "../types.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export type GoogleUser = {
  sub: string;
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
};

export function getGoogleAuthUrl(env: Env, state: string): string {
  const redirectUri = getRedirectUri(env);
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "consent",
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export async function exchangeGoogleCode(
  env: Env,
  code: string
): Promise<GoogleUser> {
  const redirectUri = getRedirectUri(env);
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to exchange Google authorization code");
  }

  const tokens = (await tokenResponse.json()) as { access_token: string };

  const userResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userResponse.ok) {
    throw new Error("Failed to fetch Google user info");
  }

  return userResponse.json() as Promise<GoogleUser>;
}

function getRedirectUri(env: Env): string {
  const origin =
    env.ENVIRONMENT === "development"
      ? "http://localhost:8787"
      : `https://melodia-api.${env.ENVIRONMENT === "production" ? "" : "dev."}workers.dev`;
  return `${origin}/api/auth/google/callback`;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/services/google.service.ts
git commit -m "feat: add Google OAuth service"
```

---

### Task 10: Auth Routes

**Files:**
- Create: `apps/api/src/routes/auth.ts`

- [ ] **Step 1: Create auth routes with all flows**

```typescript
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
import { userQueries, refreshTokenQueries } from "../db/queries.js";
import {
  hashPassword,
  verifyPassword,
  issueTokens,
  refreshTokenCookie,
  clearRefreshTokenCookie,
  hashRefreshToken,
} from "../services/auth.service.js";
import { sendOtp, verifyOtp } from "../services/otp.service.js";
import {
  getGoogleAuthUrl,
  exchangeGoogleCode,
} from "../services/google.service.js";
import { AppError, errorResponse } from "../middleware/error-handler.js";
import { authGuard } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

// --- Helper to parse and validate request body ---
async function parseBody<T>(c: any, schema: v.BaseSchema<any, T, any>): Promise<T> {
  const body = await c.req.json();
  const result = v.safeParse(schema, body);
  if (!result.success) {
    const message = result.issues.map((i: any) => i.message).join(", ");
    throw new AppError("VALIDATION_ERROR", message, 400);
  }
  return result.output;
}

// Helper to generate auto username
function autoUsername(): string {
  const suffix = crypto.getRandomValues(new Uint8Array(4));
  const hex = Array.from(suffix)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `user_${hex}`;
}

// Helper to send token response
function tokenResponse(c: any, accessToken: string, refreshToken: string, expiresAt: string, user: any) {
  c.header("Set-Cookie", refreshTokenCookie(refreshToken, expiresAt));
  return c.json({
    success: true,
    data: {
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        plan: user.plan,
        credits_remaining: user.credits_remaining,
        primary_auth_method: user.primary_auth_method,
        is_verified: !!user.is_verified,
      },
    },
  });
}

// POST /api/auth/register
auth.post(
  "/register",
  rateLimit({
    key: (c) => `register:${c.req.header("CF-Connecting-IP") ?? "unknown"}`,
    limit: 10,
    windowSeconds: 3600,
  }),
  async (c) => {
    const input = await parseBody(c, RegisterSchema);

    // Check uniqueness
    const existingEmail = await userQueries.findByEmail(c.env.DB, input.email);
    if (existingEmail) throw new AppError("VALIDATION_ERROR", "Email already registered");

    const existingUsername = await userQueries.findByUsername(c.env.DB, input.username);
    if (existingUsername) throw new AppError("VALIDATION_ERROR", "Username already taken");

    const passwordHash = await hashPassword(input.password);
    const userId = ulid();

    await userQueries.create(c.env.DB, {
      id: userId,
      email: input.email,
      username: input.username,
      password_hash: passwordHash,
      primary_auth_method: "email",
      is_verified: 0,
    });

    const user = await userQueries.findById(c.env.DB, userId);
    const { accessToken, refreshToken, expiresAt } = await issueTokens(
      c.env.DB,
      userId,
      c.env.JWT_SECRET
    );

    return tokenResponse(c, accessToken, refreshToken, expiresAt, user);
  }
);

// POST /api/auth/login
auth.post(
  "/login",
  async (c, next) => {
    // Rate limit by email (per spec Section 6.4) to prevent brute-force on specific accounts.
    // We parse the body early to extract the email for the rate limit key.
    const body = await c.req.json();
    const email = typeof body?.email === "string" ? body.email.toLowerCase() : "unknown";
    // Store parsed body for the route handler to reuse
    c.set("parsedBody" as any, body);
    const limiter = rateLimit({
      key: () => `login:${email}`,
      limit: 10,
      windowSeconds: 3600,
    });
    return limiter(c, next);
  },
  async (c) => {
    const input = await parseBody(c, LoginSchema);
    const user = await userQueries.findByEmail(c.env.DB, input.email);
    if (!user || !(user as any).password_hash) {
      throw new AppError("UNAUTHORIZED", "Invalid email or password", 401);
    }

    const valid = await verifyPassword(input.password, (user as any).password_hash);
    if (!valid) {
      throw new AppError("UNAUTHORIZED", "Invalid email or password", 401);
    }

    const { accessToken, refreshToken, expiresAt } = await issueTokens(
      c.env.DB,
      (user as any).id,
      c.env.JWT_SECRET
    );

    return tokenResponse(c, accessToken, refreshToken, expiresAt, user);
  }
);

// POST /api/auth/otp/send
auth.post("/otp/send", async (c) => {
  const input = await parseBody(c, OtpSendSchema);
  try {
    await sendOtp(c.env, input.phone);
  } catch (err: any) {
    if (err.message.includes("Too many")) {
      throw new AppError("RATE_LIMITED", err.message, 429);
    }
    throw new AppError("INTERNAL_ERROR", err.message, 500);
  }
  return c.json({ success: true, data: { message: "OTP sent" } });
});

// POST /api/auth/otp/verify
auth.post("/otp/verify", async (c) => {
  const input = await parseBody(c, OtpVerifySchema);
  const valid = await verifyOtp(c.env.DB, input.phone, input.code);
  if (!valid) {
    throw new AppError("UNAUTHORIZED", "Invalid or expired code", 401);
  }

  // Find or create user by phone
  let user = await userQueries.findByPhone(c.env.DB, input.phone);
  if (!user) {
    const userId = ulid();
    await userQueries.create(c.env.DB, {
      id: userId,
      phone: input.phone,
      username: autoUsername(),
      primary_auth_method: "phone",
      is_verified: 1,
    });
    user = await userQueries.findById(c.env.DB, userId);
  }

  const { accessToken, refreshToken, expiresAt } = await issueTokens(
    c.env.DB,
    (user as any).id,
    c.env.JWT_SECRET
  );

  return tokenResponse(c, accessToken, refreshToken, expiresAt, user);
});

// GET /api/auth/google
auth.get("/google", async (c) => {
  const stateBytes = crypto.getRandomValues(new Uint8Array(32));
  const state = Array.from(stateBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  await c.env.KV.put(`oauth:state:${state}`, "1", { expirationTtl: 600 });

  const url = getGoogleAuthUrl(c.env, state);
  return c.redirect(url);
});

// GET /api/auth/google/callback
auth.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");

  if (!code || !state) {
    throw new AppError("VALIDATION_ERROR", "Missing code or state parameter");
  }

  // Validate state
  const storedState = await c.env.KV.get(`oauth:state:${state}`);
  if (!storedState) {
    throw new AppError("UNAUTHORIZED", "Invalid or expired OAuth state", 401);
  }
  await c.env.KV.delete(`oauth:state:${state}`);

  // Exchange code for user info
  const googleUser = await exchangeGoogleCode(c.env, code);

  // Find or create user — account linking logic
  let user = await userQueries.findByGoogleId(c.env.DB, googleUser.sub);

  if (!user && googleUser.email) {
    // Check if email already exists (account linking)
    const existingByEmail = await userQueries.findByEmail(c.env.DB, googleUser.email);
    if (existingByEmail) {
      // Auto-link: Google verified this email
      await userQueries.linkGoogleId(c.env.DB, (existingByEmail as any).id, googleUser.sub);
      user = await userQueries.findById(c.env.DB, (existingByEmail as any).id);
    }
  }

  if (!user) {
    // Create new user
    const userId = ulid();
    await userQueries.create(c.env.DB, {
      id: userId,
      email: googleUser.email,
      username: autoUsername(),
      display_name: googleUser.name,
      avatar_url: googleUser.picture,
      google_id: googleUser.sub,
      primary_auth_method: "google",
      is_verified: 1,
    });
    user = await userQueries.findById(c.env.DB, userId);
  }

  // Generate one-time auth code
  const codeBytes = crypto.getRandomValues(new Uint8Array(32));
  const oneTimeCode = Array.from(codeBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  await c.env.KV.put(`oauth:code:${oneTimeCode}`, (user as any).id, {
    expirationTtl: 60,
  });

  const frontendOrigin = c.env.CORS_ORIGIN.split(",")[0].trim();
  return c.redirect(`${frontendOrigin}/auth/callback?code=${oneTimeCode}`);
});

// POST /api/auth/exchange
auth.post("/exchange", async (c) => {
  const input = await parseBody(c, ExchangeSchema);
  const userId = await c.env.KV.get(`oauth:code:${input.code}`);
  if (!userId) {
    throw new AppError("UNAUTHORIZED", "Invalid or expired code", 401);
  }
  await c.env.KV.delete(`oauth:code:${input.code}`);

  const user = await userQueries.findById(c.env.DB, userId);
  if (!user) {
    throw new AppError("NOT_FOUND", "User not found", 404);
  }

  const { accessToken, refreshToken, expiresAt } = await issueTokens(
    c.env.DB,
    userId,
    c.env.JWT_SECRET
  );

  return tokenResponse(c, accessToken, refreshToken, expiresAt, user);
});

// POST /api/auth/refresh
auth.post("/refresh", async (c) => {
  const cookieHeader = c.req.header("Cookie") ?? "";
  const match = cookieHeader.match(/refresh_token=([^;]+)/);
  if (!match) {
    throw new AppError("UNAUTHORIZED", "No refresh token", 401);
  }

  const token = match[1];
  const tokenHash = await hashRefreshToken(token);
  const stored = await refreshTokenQueries.findByHash(c.env.DB, tokenHash);
  if (!stored) {
    throw new AppError("UNAUTHORIZED", "Invalid refresh token", 401);
  }

  // Check expiry
  if (new Date((stored as any).expires_at) < new Date()) {
    throw new AppError("UNAUTHORIZED", "Refresh token expired", 401);
  }

  // Revoke old token
  await refreshTokenQueries.revoke(c.env.DB, (stored as any).id);

  // Issue new pair
  const user = await userQueries.findById(c.env.DB, (stored as any).user_id);
  if (!user) {
    throw new AppError("NOT_FOUND", "User not found", 404);
  }

  const { accessToken, refreshToken: newRefreshToken, expiresAt } = await issueTokens(
    c.env.DB,
    (stored as any).user_id,
    c.env.JWT_SECRET
  );

  return tokenResponse(c, accessToken, newRefreshToken, expiresAt, user);
});

// POST /api/auth/reset-password/request
auth.post("/reset-password/request", async (c) => {
  const input = await parseBody(c, ResetRequestSchema);
  const user = await userQueries.findByEmail(c.env.DB, input.email);

  // Always return success (prevent email enumeration)
  if (!user || !(user as any).phone) {
    return c.json({
      success: true,
      data: { message: "If an account exists with a linked phone, a reset code has been sent." },
    });
  }

  try {
    await sendOtp(c.env, (user as any).phone);
  } catch {
    // Swallow — don't reveal account existence
  }

  return c.json({
    success: true,
    data: { message: "If an account exists with a linked phone, a reset code has been sent." },
  });
});

// POST /api/auth/reset-password/confirm
auth.post("/reset-password/confirm", async (c) => {
  const input = await parseBody(c, ResetConfirmSchema);
  const user = await userQueries.findByEmail(c.env.DB, input.email);
  if (!user || !(user as any).phone) {
    throw new AppError("UNAUTHORIZED", "Invalid reset request", 401);
  }

  const valid = await verifyOtp(c.env.DB, (user as any).phone, input.code);
  if (!valid) {
    throw new AppError("UNAUTHORIZED", "Invalid or expired code", 401);
  }

  const passwordHash = await hashPassword(input.new_password);
  await userQueries.updatePasswordHash(c.env.DB, (user as any).id, passwordHash);
  await refreshTokenQueries.revokeAllForUser(c.env.DB, (user as any).id);

  const { accessToken, refreshToken, expiresAt } = await issueTokens(
    c.env.DB,
    (user as any).id,
    c.env.JWT_SECRET
  );

  const updatedUser = await userQueries.findById(c.env.DB, (user as any).id);
  return tokenResponse(c, accessToken, refreshToken, expiresAt, updatedUser);
});

// GET /api/auth/me (protected)
auth.get("/me", authGuard(), async (c) => {
  const userId = c.get("userId");
  const user = await userQueries.findById(c.env.DB, userId);
  if (!user) {
    throw new AppError("NOT_FOUND", "User not found", 404);
  }
  return c.json({
    success: true,
    data: {
      id: (user as any).id,
      email: (user as any).email,
      phone: (user as any).phone,
      username: (user as any).username,
      display_name: (user as any).display_name,
      avatar_url: (user as any).avatar_url,
      plan: (user as any).plan,
      credits_remaining: (user as any).credits_remaining,
      primary_auth_method: (user as any).primary_auth_method,
      is_verified: !!(user as any).is_verified,
      created_at: (user as any).created_at,
    },
  });
});

// POST /api/auth/logout (protected)
auth.post("/logout", authGuard(), async (c) => {
  const cookieHeader = c.req.header("Cookie") ?? "";
  const match = cookieHeader.match(/refresh_token=([^;]+)/);
  if (match) {
    const tokenHash = await hashRefreshToken(match[1]);
    const stored = await refreshTokenQueries.findByHash(c.env.DB, tokenHash);
    if (stored) {
      await refreshTokenQueries.revoke(c.env.DB, (stored as any).id);
    }
  }
  c.header("Set-Cookie", clearRefreshTokenCookie());
  return c.json({ success: true, data: { message: "Logged out" } });
});

export default auth;
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/auth.ts
git commit -m "feat: add auth routes — register, login, OTP, Google OAuth, refresh, reset, logout"
```

---

### Task 11: Credits, Settings & Stub Routes

**Files:**
- Create: `apps/api/src/routes/credits.ts`
- Create: `apps/api/src/routes/settings.ts`
- Create: `apps/api/src/routes/songs.ts`
- Create: `apps/api/src/routes/lyrics.ts`
- Create: `apps/api/src/routes/artwork.ts`
- Create: `apps/api/src/routes/playlists.ts`
- Create: `apps/api/src/routes/users.ts`

- [ ] **Step 1: Create credits routes**

```typescript
import { Hono } from "hono";
import type { Env, Variables } from "../types.js";
import { creditQueries } from "../db/queries.js";
import { authGuard } from "../middleware/auth.js";

const credits = new Hono<{ Bindings: Env; Variables: Variables }>();

credits.use("*", authGuard());

credits.get("/", async (c) => {
  const userId = c.get("userId");
  const balance = await creditQueries.getBalance(c.env.DB, userId);
  return c.json({ success: true, data: balance });
});

credits.get("/history", async (c) => {
  const userId = c.get("userId");
  const result = await creditQueries.getHistory(c.env.DB, userId);
  return c.json({ success: true, data: result.results });
});

export default credits;
```

- [ ] **Step 2: Create settings routes**

```typescript
import { Hono } from "hono";
import * as v from "valibot";
import { UpdateProfileSchema } from "@melodia/shared";
import type { Env, Variables } from "../types.js";
import { userQueries } from "../db/queries.js";
import { authGuard } from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";

const settings = new Hono<{ Bindings: Env; Variables: Variables }>();

settings.use("*", authGuard());

settings.put("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const result = v.safeParse(UpdateProfileSchema, body);
  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", result.issues.map((i) => i.message).join(", "));
  }

  const input = result.output;

  // Check username uniqueness if changing
  if (input.username) {
    const existing = await userQueries.findByUsername(c.env.DB, input.username);
    if (existing && (existing as any).id !== userId) {
      throw new AppError("VALIDATION_ERROR", "Username already taken");
    }
  }

  await userQueries.updateProfile(c.env.DB, userId, input);
  const user = await userQueries.findById(c.env.DB, userId);
  return c.json({ success: true, data: user });
});

export default settings;
```

- [ ] **Step 3: Create stub routes (songs, lyrics, artwork, playlists, users)**

Each file follows this pattern:

```typescript
// apps/api/src/routes/songs.ts (same pattern for lyrics.ts, artwork.ts, playlists.ts, users.ts)
import { Hono } from "hono";
import type { Env, Variables } from "../types.js";
import { errorResponse } from "../middleware/error-handler.js";

const songs = new Hono<{ Bindings: Env; Variables: Variables }>();

songs.all("/*", (c) => {
  return errorResponse(c, "NOT_IMPLEMENTED", "Songs API coming in Sub-project 2");
});

export default songs;
```

Create identical stubs for `lyrics.ts`, `artwork.ts`, `playlists.ts`, `users.ts` — each with a different message referencing the correct sub-project.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/
git commit -m "feat: add credits, settings routes and stub routes for future sub-projects"
```

---

### Task 12: Hono App Entry Point

**Files:**
- Create: `apps/api/src/index.ts`

- [ ] **Step 1: Create main Hono app with route mounting**

```typescript
import { Hono } from "hono";
import type { Env, Variables } from "./types.js";
import { corsMiddleware } from "./middleware/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import authRoutes from "./routes/auth.js";
import creditsRoutes from "./routes/credits.js";
import settingsRoutes from "./routes/settings.js";
import songsRoutes from "./routes/songs.js";
import lyricsRoutes from "./routes/lyrics.js";
import artworkRoutes from "./routes/artwork.js";
import playlistsRoutes from "./routes/playlists.js";
import usersRoutes from "./routes/users.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global middleware
app.use("*", async (c, next) => {
  const corsHandler = corsMiddleware(c.env.CORS_ORIGIN);
  return corsHandler(c, next);
});
app.use("*", errorHandler());

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Route mounting
app.route("/api/auth", authRoutes);
app.route("/api/credits", creditsRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/songs", songsRoutes);
app.route("/api/lyrics", lyricsRoutes);
app.route("/api/artwork", artworkRoutes);
app.route("/api/playlists", playlistsRoutes);
app.route("/api/users", usersRoutes);

// 404 fallback
app.notFound((c) =>
  c.json({ success: false, error: { code: "NOT_FOUND", message: "Route not found" } }, 404)
);

export default app;
```

- [ ] **Step 2: Install all dependencies and verify**

```bash
npm install
npm run typecheck -w apps/api
```

Expected: No type errors (or minimal ones to fix).

- [ ] **Step 3: Start dev server and test health endpoint**

```bash
npm run db:migrate:local -w apps/api
npm run dev -w apps/api
# In another terminal:
curl http://localhost:8787/api/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat: add Hono app entry point with route mounting and middleware"
```

---

## Chunk 4: React Frontend Shell

### Task 13: Frontend Package Setup

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/styles/globals.css`

- [ ] **Step 1: Create apps/web/package.json**

```json
{
  "name": "@melodia/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@melodia/shared": "*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0",
    "valibot": "^1.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.4.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create apps/web/vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 3: Create apps/web/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "paths": {
      "@melodia/shared": ["../../packages/shared/src"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "../../packages/shared" }]
}
```

- [ ] **Step 4: Create apps/web/tailwind.config.ts**

```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal: "#1A1A2E",
        midnight: "#16213E",
        amber: "#F0A500",
        coral: "#E74C3C",
        teal: "#00D2FF",
        "surface-1": "#1E1E36",
        "surface-2": "#252542",
        "surface-3": "#2D2D50",
      },
    },
  },
} satisfies Config;
```

- [ ] **Step 5: Create apps/web/src/styles/globals.css**

```css
@import "tailwindcss";

@theme {
  --color-charcoal: #1A1A2E;
  --color-midnight: #16213E;
  --color-amber: #F0A500;
  --color-coral: #E74C3C;
  --color-teal: #00D2FF;
  --color-surface-1: #1E1E36;
  --color-surface-2: #252542;
  --color-surface-3: #2D2D50;
}

body {
  background-color: var(--color-charcoal);
  color: #e2e8f0;
  font-family: "Inter", system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 6: Create apps/web/index.html**

```html
<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Melodia — AI Music Generation</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/
git commit -m "chore: add frontend package with Vite, React, Tailwind dark theme"
```

---

### Task 14: API Client & Auth Hooks

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/hooks/useAuth.ts`
- Create: `apps/web/src/hooks/useApi.ts`

- [ ] **Step 1: Create typed API client**

```typescript
// apps/web/src/lib/api.ts
const API_BASE = "/api";

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

class ApiClient {
  private accessToken: string | null = null;
  private onUnauthorized: (() => Promise<boolean>) | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  setOnUnauthorized(handler: () => Promise<boolean>) {
    this.onUnauthorized = handler;
  }

  async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    let response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });

    // If 401 and we have a refresh handler, try to refresh
    if (response.status === 401 && this.onUnauthorized) {
      const refreshed = await this.onUnauthorized();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${this.accessToken}`;
        response = await fetch(`${API_BASE}${path}`, {
          ...options,
          headers,
          credentials: "include",
        });
      }
    }

    return response.json();
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: "DELETE" });
  }
}

export const api = new ApiClient();
```

- [ ] **Step 2: Create auth hook (useAuth)**

```typescript
// apps/web/src/hooks/useAuth.ts
import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { User } from "@melodia/shared";
import { api } from "../lib/api.js";

type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
};

type AuthAction =
  | { type: "SET_USER"; user: User; accessToken: string }
  | { type: "LOGOUT" }
  | { type: "SET_LOADING"; loading: boolean };

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SET_USER":
      api.setAccessToken(action.accessToken);
      return { user: action.user, isAuthenticated: true, isLoading: false };
    case "LOGOUT":
      api.setAccessToken(null);
      return { user: null, isAuthenticated: false, isLoading: false };
    case "SET_LOADING":
      return { ...state, isLoading: action.loading };
  }
}

type AuthContextType = AuthState & {
  login: (accessToken: string, user: User) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const login = useCallback((accessToken: string, user: User) => {
    dispatch({ type: "SET_USER", user, accessToken });
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const res = await api.post<{ access_token: string; user: User }>(
        "/auth/refresh"
      );
      if (res.success) {
        dispatch({
          type: "SET_USER",
          user: res.data.user,
          accessToken: res.data.access_token,
        });
        return true;
      }
    } catch {}
    dispatch({ type: "LOGOUT" });
    return false;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    dispatch({ type: "LOGOUT" });
  }, []);

  // Silent refresh on mount
  useEffect(() => {
    refresh();
    api.setOnUnauthorized(refresh);
  }, [refresh]);

  return (
    <AuthContext value={{ ...state, login, logout, refresh }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 3: Create API hook (useApi)**

```typescript
// apps/web/src/hooks/useApi.ts
import { useState, useCallback } from "react";
import { api } from "../lib/api.js";

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(
    async <T>(fn: () => Promise<{ success: boolean; data?: T; error?: { message: string } }>) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fn();
        if (!res.success) {
          setError(res.error?.message ?? "Something went wrong");
          return null;
        }
        return res.data ?? null;
      } catch (err: any) {
        setError(err.message ?? "Network error");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { call, loading, error, clearError: () => setError(null) };
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/ apps/web/src/hooks/
git commit -m "feat: add API client with auth context, token refresh, and useApi hook"
```

---

### Task 15: Frontend Pages & Router

**Files:**
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/components/AuthGuard.tsx`
- Create: `apps/web/src/components/Layout.tsx`
- Create: `apps/web/src/pages/Landing.tsx`
- Create: `apps/web/src/pages/Login.tsx`
- Create: `apps/web/src/pages/Register.tsx`
- Create: `apps/web/src/pages/VerifyOtp.tsx`
- Create: `apps/web/src/pages/AuthCallback.tsx`
- Create: `apps/web/src/pages/ResetPassword.tsx`
- Create: `apps/web/src/pages/Dashboard.tsx`
- Create: `apps/web/src/pages/Settings.tsx`

- [ ] **Step 1: Create main.tsx entry point**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AuthProvider } from "./hooks/useAuth.js";
import App from "./App.js";
import "./styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
```

- [ ] **Step 2: Create App.tsx with routes**

```tsx
import { Routes, Route } from "react-router";
import { AuthGuard } from "./components/AuthGuard.js";
import { Layout } from "./components/Layout.js";
import Landing from "./pages/Landing.js";
import Login from "./pages/Login.js";
import Register from "./pages/Register.js";
import VerifyOtp from "./pages/VerifyOtp.js";
import AuthCallback from "./pages/AuthCallback.js";
import ResetPassword from "./pages/ResetPassword.js";
import Dashboard from "./pages/Dashboard.js";
import Settings from "./pages/Settings.js";

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes */}
      <Route element={<AuthGuard />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 3: Create AuthGuard component**

```tsx
import { Navigate, Outlet } from "react-router";
import { useAuth } from "../hooks/useAuth.js";

export function AuthGuard() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-charcoal">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
```

- [ ] **Step 4: Create Layout component**

```tsx
import { Outlet, Link, useNavigate } from "react-router";
import { useAuth } from "../hooks/useAuth.js";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-charcoal">
      <nav className="border-b border-surface-3 bg-midnight/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link to="/dashboard" className="text-xl font-bold text-amber">
            Melodia
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="text-sm text-gray-300 hover:text-white">
              Dashboard
            </Link>
            <Link to="/settings" className="text-sm text-gray-300 hover:text-white">
              Settings
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">
                {user?.username}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-lg bg-surface-2 px-3 py-1.5 text-sm text-gray-300 hover:bg-surface-3"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Create Landing page**

A minimal landing page with hero and CTA. Keep it simple — this gets polished in Sub-project 3.

```tsx
import { Link } from "react-router";

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-charcoal">
      <nav className="flex h-16 items-center justify-between px-6">
        <span className="text-xl font-bold text-amber">Melodia</span>
        <div className="flex gap-4">
          <Link to="/login" className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:text-white">
            Sign In
          </Link>
          <Link to="/register" className="rounded-lg bg-amber px-4 py-2 text-sm font-medium text-charcoal hover:bg-amber/90">
            Get Started
          </Link>
        </div>
      </nav>
      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-4 text-5xl font-bold text-white">
          Create Music with AI
        </h1>
        <p className="mb-8 max-w-xl text-lg text-gray-400">
          From a simple idea to a fully produced song — lyrics, vocals,
          instrumentation, and album artwork. All powered by AI.
        </p>
        <Link
          to="/register"
          className="rounded-xl bg-amber px-8 py-3 text-lg font-semibold text-charcoal hover:bg-amber/90"
        >
          Start Creating — Free
        </Link>
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Create Login page (tabbed: email, phone, Google)**

```tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../hooks/useAuth.js";
import { useApi } from "../hooks/useApi.js";
import { api } from "../lib/api.js";
import type { User } from "@melodia/shared";

type Tab = "email" | "phone" | "google";

export default function Login() {
  const [tab, setTab] = useState<Tab>("email");
  const { login } = useAuth();
  const navigate = useNavigate();
  const { call, loading, error } = useApi();

  // Email form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Phone form
  const [phone, setPhone] = useState("");

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await call(() =>
      api.post<{ access_token: string; user: User }>("/auth/login", { email, password })
    );
    if (data) {
      login(data.access_token, data.user);
      navigate("/dashboard");
    }
  };

  const handlePhoneSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await call(() => api.post("/auth/otp/send", { phone }));
    if (data) {
      navigate(`/verify-otp?phone=${encodeURIComponent(phone)}`);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "google", label: "Google" },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal px-4">
      <div className="w-full max-w-md rounded-2xl bg-surface-1 p-8">
        <h1 className="mb-6 text-center text-2xl font-bold text-white">
          Welcome to Melodia
        </h1>

        {/* Tabs */}
        <div className="mb-6 flex rounded-xl bg-surface-2 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-surface-3 text-white"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-coral/10 p-3 text-sm text-coral">
            {error}
          </div>
        )}

        {/* Email Tab */}
        {tab === "email" && (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl bg-surface-2 px-4 py-3 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-amber"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl bg-surface-2 px-4 py-3 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-amber"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-amber py-3 font-semibold text-charcoal hover:bg-amber/90 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
            <Link to="/reset-password" className="block text-center text-sm text-gray-400 hover:text-amber">
              Forgot password?
            </Link>
          </form>
        )}

        {/* Phone Tab */}
        {tab === "phone" && (
          <form onSubmit={handlePhoneSend} className="space-y-4">
            <input
              type="tel"
              placeholder="+233XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full rounded-xl bg-surface-2 px-4 py-3 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-amber"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-amber py-3 font-semibold text-charcoal hover:bg-amber/90 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Code"}
            </button>
          </form>
        )}

        {/* Google Tab */}
        {tab === "google" && (
          <button
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-white py-3 font-semibold text-gray-800 hover:bg-gray-100"
          >
            Continue with Google
          </button>
        )}

        <p className="mt-6 text-center text-sm text-gray-400">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="text-amber hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create Register page**

```tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../hooks/useAuth.js";
import { useApi } from "../hooks/useApi.js";
import { api } from "../lib/api.js";
import type { User } from "@melodia/shared";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const { call, loading, error } = useApi();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await call(() =>
      api.post<{ access_token: string; user: User }>("/auth/register", {
        email,
        password,
        username,
      })
    );
    if (data) {
      login(data.access_token, data.user);
      navigate("/dashboard");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal px-4">
      <div className="w-full max-w-md rounded-2xl bg-surface-1 p-8">
        <h1 className="mb-6 text-center text-2xl font-bold text-white">
          Create your account
        </h1>

        {error && (
          <div className="mb-4 rounded-lg bg-coral/10 p-3 text-sm text-coral">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full rounded-xl bg-surface-2 px-4 py-3 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-amber"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl bg-surface-2 px-4 py-3 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-amber"
          />
          <input
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-xl bg-surface-2 px-4 py-3 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-amber"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-amber py-3 font-semibold text-charcoal hover:bg-amber/90 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Already have an account?{" "}
          <Link to="/login" className="text-amber hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create VerifyOtp page**

```tsx
import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../hooks/useAuth.js";
import { useApi } from "../hooks/useApi.js";
import { api } from "../lib/api.js";
import type { User } from "@melodia/shared";

export default function VerifyOtp() {
  const [searchParams] = useSearchParams();
  const phone = searchParams.get("phone") ?? "";
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { call, loading, error } = useApi();

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
    // Auto-submit when all 6 digits entered
    if (value && index === 5 && next.every((d) => d)) {
      handleSubmit(next.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (code?: string) => {
    const otp = code ?? digits.join("");
    if (otp.length !== 6) return;
    const data = await call(() =>
      api.post<{ access_token: string; user: User }>("/auth/otp/verify", {
        phone,
        code: otp,
      })
    );
    if (data) {
      login(data.access_token, data.user);
      navigate("/dashboard");
    }
  };

  const maskedPhone = phone.replace(/(\+233)(\d{2})(\d+)(\d{2})/, "$1 $2 *** $4");

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal px-4">
      <div className="w-full max-w-md rounded-2xl bg-surface-1 p-8 text-center">
        <h1 className="mb-2 text-2xl font-bold text-white">
          Enter verification code
        </h1>
        <p className="mb-6 text-sm text-gray-400">Sent to {maskedPhone}</p>

        {error && (
          <div className="mb-4 rounded-lg bg-coral/10 p-3 text-sm text-coral">
            {error}
          </div>
        )}

        <div className="mb-6 flex justify-center gap-3">
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputsRef.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="h-14 w-12 rounded-xl bg-surface-2 text-center text-2xl font-bold text-white outline-none focus:ring-2 focus:ring-amber"
            />
          ))}
        </div>

        <button
          onClick={() => handleSubmit()}
          disabled={loading || digits.some((d) => !d)}
          className="w-full rounded-xl bg-amber py-3 font-semibold text-charcoal hover:bg-amber/90 disabled:opacity-50"
        >
          {loading ? "Verifying..." : "Verify"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Create AuthCallback page (Google OAuth)**

```tsx
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../hooks/useAuth.js";
import { api } from "../lib/api.js";
import type { User } from "@melodia/shared";

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!code) {
      navigate("/login");
      return;
    }
    (async () => {
      const res = await api.post<{ access_token: string; user: User }>(
        "/auth/exchange",
        { code }
      );
      if (res.success) {
        login(res.data.access_token, res.data.user);
        navigate("/dashboard");
      } else {
        navigate("/login");
      }
    })();
  }, [code, login, navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-charcoal">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber border-t-transparent" />
    </div>
  );
}
```

- [ ] **Step 10: Create ResetPassword page**

```tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../hooks/useAuth.js";
import { useApi } from "../hooks/useApi.js";
import { api } from "../lib/api.js";
import type { User } from "@melodia/shared";

export default function ResetPassword() {
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const { call, loading, error } = useApi();

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await call(() =>
      api.post<{ message: string }>("/auth/reset-password/request", { email })
    );
    if (data) {
      setMessage(data.message);
      setStep("confirm");
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await call(() =>
      api.post<{ access_token: string; user: User }>(
        "/auth/reset-password/confirm",
        { email, code, new_password: newPassword }
      )
    );
    if (data) {
      login(data.access_token, data.user);
      navigate("/dashboard");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal px-4">
      <div className="w-full max-w-md rounded-2xl bg-surface-1 p-8">
        <h1 className="mb-6 text-center text-2xl font-bold text-white">
          Reset Password
        </h1>

        {error && (
          <div className="mb-4 rounded-lg bg-coral/10 p-3 text-sm text-coral">{error}</div>
        )}
        {message && (
          <div className="mb-4 rounded-lg bg-teal/10 p-3 text-sm text-teal">{message}</div>
        )}

        {step === "request" ? (
          <form onSubmit={handleRequest} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl bg-surface-2 px-4 py-3 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-amber"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-amber py-3 font-semibold text-charcoal hover:bg-amber/90 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Reset Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="space-y-4">
            <input
              type="text"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              maxLength={6}
              className="w-full rounded-xl bg-surface-2 px-4 py-3 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-amber"
            />
            <input
              type="password"
              placeholder="New password (min 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-xl bg-surface-2 px-4 py-3 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-amber"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-amber py-3 font-semibold text-charcoal hover:bg-amber/90 disabled:opacity-50"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        <Link to="/login" className="mt-6 block text-center text-sm text-gray-400 hover:text-amber">
          Back to login
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 11: Create Dashboard page (placeholder)**

```tsx
import { useAuth } from "../hooks/useAuth.js";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold text-white">
        Welcome, {user?.display_name ?? user?.username}
      </h1>
      <p className="mb-8 text-gray-400">
        Credits remaining: {user?.credits_remaining}
      </p>
      <div className="rounded-2xl border border-surface-3 bg-surface-1 p-12 text-center">
        <p className="text-lg text-gray-400">
          Song studio coming in Sub-project 3
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 12: Create Settings page**

```tsx
import { useState } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { useApi } from "../hooks/useApi.js";
import { api } from "../lib/api.js";

export default function Settings() {
  const { user } = useAuth();
  const { call, loading, error } = useApi();
  const [username, setUsername] = useState(user?.username ?? "");
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    const data = await call(() =>
      api.put("/settings", { username, display_name: displayName })
    );
    if (data) setSaved(true);
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-white">Settings</h1>

      <div className="rounded-2xl bg-surface-1 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Profile</h2>

        {error && (
          <div className="mb-4 rounded-lg bg-coral/10 p-3 text-sm text-coral">{error}</div>
        )}
        {saved && (
          <div className="mb-4 rounded-lg bg-teal/10 p-3 text-sm text-teal">
            Profile updated
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-400">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl bg-surface-2 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-amber"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl bg-surface-2 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-amber"
            />
          </div>

          <div className="rounded-xl bg-surface-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Plan</span>
              <span className="rounded-lg bg-amber/20 px-3 py-1 text-sm font-medium text-amber capitalize">
                {user?.plan}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-amber py-3 font-semibold text-charcoal hover:bg-amber/90 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 13: Install all dependencies and verify frontend builds**

```bash
npm install
npm run dev -w apps/web
```

Expected: Vite dev server starts on `localhost:5173`, landing page renders.

- [ ] **Step 14: Commit**

```bash
git add apps/web/src/
git commit -m "feat: add React frontend — auth pages, routing, layout, dark theme"
```

---

## Chunk 5: Integration Verification & Final Commit

### Task 16: Full Stack Smoke Test

- [ ] **Step 1: Start both dev servers**

```bash
# Terminal 1:
npm run db:migrate:local -w apps/api
npm run dev -w apps/api

# Terminal 2:
npm run dev -w apps/web
```

- [ ] **Step 2: Create .dev.vars for local secrets**

Create `apps/api/.dev.vars` (gitignored):

```
JWT_SECRET=dev-secret-key-change-in-production-000000
HUBTEL_CLIENT_ID=test
HUBTEL_CLIENT_SECRET=test
HUBTEL_SENDER_ID=Melodia
GOOGLE_CLIENT_ID=test
GOOGLE_CLIENT_SECRET=test
```

- [ ] **Step 3: Test health endpoint**

```bash
curl http://localhost:8787/api/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 4: Test registration flow**

```bash
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@melodia.com","password":"testpass123","username":"testuser"}'
```

Expected: 200 with `access_token` and user data.

- [ ] **Step 5: Test login flow**

```bash
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@melodia.com","password":"testpass123"}'
```

Expected: 200 with `access_token` and user data.

- [ ] **Step 6: Test protected route**

Use the `access_token` from Step 5:

```bash
curl http://localhost:8787/api/auth/me \
  -H "Authorization: Bearer <access_token>"
```

Expected: 200 with user profile.

- [ ] **Step 7: Test stub route**

```bash
curl http://localhost:8787/api/songs
```

Expected: 501 with `NOT_IMPLEMENTED`.

- [ ] **Step 8: Visit frontend in browser**

Open `http://localhost:5173` — landing page should render with dark theme. Navigate to `/register`, create an account, and verify redirect to `/dashboard`.

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "chore: add dev vars template and verify full stack integration"
```

---

**End of plan. Total: 16 tasks across 5 chunks.**
