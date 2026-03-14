# Melodia — Sub-project 1: Project Scaffold, Database & Authentication

**Date:** 2026-03-14
**Status:** Draft
**Scope:** Monorepo setup, D1 schema, auth (email/password + Google OAuth + Phone OTP), API scaffold, React frontend shell

---

## 1. Context

Melodia is an AI music generation platform by Hodges & Co. Limited, targeting Africa starting from Ghana. Users provide a text prompt and receive a fully produced song with lyrics, vocals, instrumentation, and album artwork.

The full platform is decomposed into 6 sub-projects:

1. **Project scaffold + DB + Auth** (this spec)
2. Song Generation Pipeline
3. React Frontend — Core Studio
4. Library, Explore & Social
5. Credits, Pricing & Monetization (Paystack)
6. Advanced Features

This sub-project establishes the foundation: monorepo structure, full database schema, all authentication methods, API middleware, and a React frontend with auth flows.

---

## 2. Technology Decisions

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Monorepo | npm workspaces | Shared types between API and frontend, single PR for full-stack changes |
| API framework | Hono | Purpose-built for Workers, middleware ecosystem, TypeScript-first |
| Frontend | Vite + React + React Router | SPA-oriented, fast dev, clean Pages deployment |
| Database | Cloudflare D1 (SQLite) | Spec requirement, edge-native |
| ID generation | ULIDs | Time-sortable for pagination, URL-friendly, shorter than UUIDs |
| Password hashing | Web Crypto PBKDF2 | Native to Workers, zero bundle impact, 600k iterations SHA-256 |
| Validation | Valibot | Tree-shakeable (~1KB), Zod-like DX, shared schemas |
| SMS OTP | Hubtel | Ghanaian provider, best local SMS delivery rates |
| OAuth | Google | Most widely used in Ghana |
| Styling | Tailwind CSS | Utility-first, dark theme, rapid UI development |
| Payments | Paystack (Sub-project 5) | Africa-native, GHS/Mobile Money support |

---

## 3. Monorepo Structure

```
melodia/
├── apps/
│   ├── api/                          # Cloudflare Workers (Hono)
│   │   ├── src/
│   │   │   ├── index.ts              # Hono app entry, route mounting
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # JWT verification guard
│   │   │   │   ├── cors.ts           # CORS config
│   │   │   │   ├── rate-limit.ts     # Per-user/IP rate limiting via KV
│   │   │   │   └── error-handler.ts  # Global error handler
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts           # /api/auth/*
│   │   │   │   ├── songs.ts          # /api/songs/* (stub)
│   │   │   │   ├── lyrics.ts         # /api/lyrics/* (stub)
│   │   │   │   ├── artwork.ts        # /api/artwork/* (stub)
│   │   │   │   ├── playlists.ts      # /api/playlists/* (stub)
│   │   │   │   ├── users.ts           # /api/users/* (stub)
│   │   │   │   ├── credits.ts        # /api/credits/* (stub)
│   │   │   │   └── settings.ts       # PUT /api/settings (profile update)
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts   # Password hashing, JWT, token logic
│   │   │   │   ├── otp.service.ts    # Hubtel SMS OTP send/verify
│   │   │   │   └── google.service.ts # Google OAuth flow
│   │   │   ├── db/
│   │   │   │   ├── schema.sql        # Full D1 schema
│   │   │   │   └── queries.ts        # Prepared statement helpers
│   │   │   └── types.ts              # Worker env bindings type
│   │   ├── wrangler.toml
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── web/                          # Vite + React (Cloudflare Pages)
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx               # Router setup
│       │   ├── pages/
│       │   │   ├── Landing.tsx
│       │   │   ├── Login.tsx         # Tabbed: email, phone, google
│       │   │   ├── Register.tsx
│       │   │   ├── VerifyOtp.tsx     # 6-digit OTP input
│       │   │   ├── AuthCallback.tsx  # Google OAuth code exchange
│       │   │   ├── ResetPassword.tsx # Password reset (request + confirm)
│       │   │   ├── Dashboard.tsx     # Placeholder for studio
│       │   │   └── Settings.tsx      # Profile, plan display
│       │   ├── components/
│       │   │   ├── AuthGuard.tsx     # Protected route wrapper
│       │   │   ├── Layout.tsx        # App shell (nav, sidebar)
│       │   │   └── ui/              # Shared UI primitives
│       │   ├── hooks/
│       │   │   ├── useAuth.ts        # Auth context + token management
│       │   │   └── useApi.ts         # Fetch wrapper with auth headers
│       │   ├── lib/
│       │   │   └── api.ts            # Typed API client
│       │   └── styles/
│       │       └── globals.css       # Tailwind + custom theme
│       ├── index.html
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── schemas/              # Valibot schemas
│       │   │   ├── auth.ts
│       │   │   ├── song.ts
│       │   │   ├── playlist.ts
│       │   │   └── user.ts
│       │   ├── constants.ts          # Plans, genres, limits, enums
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
│
├── package.json                      # npm workspaces root
├── tsconfig.base.json
└── .gitignore
```

---

## 4. Database Schema (D1)

### 4.1 Users Table

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,                -- ULID
  email TEXT UNIQUE,                  -- Nullable for phone-only users
  phone TEXT UNIQUE,                  -- E.164 format: +233XXXXXXXXX
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  password_hash TEXT,                 -- Format: base64(salt):base64(hash). Null for OAuth/OTP-only users
  google_id TEXT UNIQUE,              -- Google OAuth sub
  primary_auth_method TEXT NOT NULL DEFAULT 'email' CHECK (primary_auth_method IN ('email', 'phone', 'google')),  -- Tracks original registration method
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'creator', 'pro', 'enterprise')),
  credits_remaining INTEGER DEFAULT 5,
  credits_reset_at TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### 4.2 OTP Codes Table

```sql
CREATE TABLE otp_codes (
  id TEXT PRIMARY KEY,                -- ULID
  phone TEXT NOT NULL,
  code TEXT NOT NULL,                 -- 6-digit code
  expires_at TEXT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,         -- Max 3 attempts per code
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 4.3 Refresh Tokens Table

```sql
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,                -- ULID
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 4.4 Songs Table

```sql
CREATE TABLE songs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating_lyrics', 'generating_music', 'generating_artwork', 'processing', 'completed', 'failed')),
  user_prompt TEXT NOT NULL,
  lyrics TEXT,
  lyrics_structured TEXT,
  genre TEXT,
  sub_genre TEXT,
  mood TEXT,
  style_tags TEXT,
  bpm INTEGER,
  key_signature TEXT,
  time_signature TEXT DEFAULT '4/4',
  duration_seconds INTEGER DEFAULT 180,
  vocal_style TEXT,
  vocal_language TEXT DEFAULT 'en',
  instruments TEXT,
  audio_url TEXT,
  audio_format TEXT DEFAULT 'wav',
  stems_url TEXT,
  waveform_url TEXT,
  artwork_url TEXT,
  artwork_prompt TEXT,
  ace_step_seed INTEGER,
  ace_step_model TEXT DEFAULT 'turbo',
  ace_step_steps INTEGER DEFAULT 8,
  variation_group_id TEXT,
  variation_index INTEGER DEFAULT 0,
  is_selected_variation BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  play_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  generation_started_at TEXT,
  generation_completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### 4.5 Supporting Tables

```sql
CREATE TABLE playlists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE playlist_songs (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (playlist_id, song_id)
);

CREATE TABLE song_likes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, song_id)
);

CREATE TABLE credit_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('song_generation', 'daily_reset', 'purchase', 'referral', 'signup_bonus')),
  song_id TEXT REFERENCES songs(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE style_presets (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  style_tags TEXT NOT NULL,
  lora_path TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  use_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 4.6 Indexes

```sql
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_google ON users(google_id);
CREATE INDEX idx_otp_phone ON otp_codes(phone, used, expires_at);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id, revoked);
CREATE INDEX idx_songs_user ON songs(user_id);
CREATE INDEX idx_songs_status ON songs(status);
CREATE INDEX idx_songs_public ON songs(is_public, play_count DESC);
CREATE INDEX idx_songs_variation ON songs(variation_group_id);
CREATE INDEX idx_playlists_user ON playlists(user_id);
CREATE INDEX idx_credits_user ON credit_transactions(user_id);
```

---

## 5. Authentication Design

### 5.1 Token Strategy

- **Access token:** JWT, 15-minute expiry, stored in React state (memory only). Payload: `{ sub: userId, iat, exp }`. Signed with HMAC-SHA256 via Web Crypto API. Note: `plan` is intentionally excluded from the JWT payload to avoid stale-data issues when a user upgrades — plan is fetched from D1 on requests that need it.
- **Refresh token:** Random 256-bit token encoded as base64url (44 chars), 7-day expiry, stored as `httpOnly; Secure; SameSite=Strict; Path=/api/auth` cookie. Hashed (SHA-256, hex-encoded) before storage in D1 `refresh_tokens` table. Rotated on each use.
- **Logout:** Revokes refresh token in D1, clears cookie.
- **CSRF protection:** `SameSite=Strict` on the refresh cookie ensures the cookie is never sent on cross-origin requests. Combined with the `Authorization: Bearer` header requirement on protected routes, this provides double CSRF protection.

### 5.2 Password Hashing (PBKDF2)

- **Algorithm:** PBKDF2 with SHA-256, 600,000 iterations
- **Salt:** 16 bytes, cryptographically random via `crypto.getRandomValues()`
- **Derived key length:** 32 bytes
- **Storage format:** `base64(salt):base64(hash)` stored in `users.password_hash`
- **Verification:** Split stored value on `:`, decode salt, re-derive hash, compare using `timingSafeEqual`

### 5.3 Flow 1: Email + Password

**Register:** `POST /api/auth/register { email, password, username }`
- Validate with Valibot (email format, password min 8 chars, username 3-20 chars alphanumeric)
- Check email/username uniqueness in D1
- Hash password per Section 5.2
- Create user record (`primary_auth_method: 'email'`, `is_verified: false`)
- Issue access + refresh tokens

**Login:** `POST /api/auth/login { email, password }`
- Lookup user by email
- Verify password per Section 5.2
- Issue access + refresh tokens

### 5.4 Flow 2: Phone + SMS OTP (Hubtel)

**Send OTP:** `POST /api/auth/otp/send { phone }`
- Validate phone format (+233XXXXXXXXX via Valibot)
- Rate limit: max 3 OTP requests per phone per hour (KV key: `rate:otp:{phone}`)
- **Invalidate all previous unused OTPs for this phone** (prevents parallel brute-force across multiple codes)
- Generate cryptographically random 6-digit code via `crypto.getRandomValues()`
- Store in `otp_codes` table with 5-minute expiry
- Send via Hubtel SMS API:
  - **Endpoint:** `POST https://sms.hubtel.com/v1/messages/send`
  - **Auth:** HTTP Basic Auth — `Authorization: Basic base64(HUBTEL_CLIENT_ID:HUBTEL_CLIENT_SECRET)`
  - **Body:** `{ "From": "Melodia", "To": "+233XXXXXXXXX", "Content": "Your Melodia code: XXXXXX. Expires in 5 minutes." }`

**Verify OTP:** `POST /api/auth/otp/verify { phone, code }`
- Lookup latest unused OTP for phone where not expired
- Check attempts < 3, increment attempt counter
- If valid: mark OTP as used
- Find or create user by phone (`primary_auth_method: 'phone'`, `is_verified: true`)
  - New users get auto-generated username (e.g., `user_XXXX`)
- Issue access + refresh tokens

### 5.5 Flow 3: Google OAuth

**Initiate:** `GET /api/auth/google`
- Generate cryptographically random `state` parameter (32 bytes, hex-encoded)
- Store `state` in KV with 10-minute TTL: `oauth:state:{state_value} = 1`
- Redirect to Google OAuth consent screen with `state` parameter
- Scopes: `openid`, `email`, `profile`
- `redirect_uri`: `/api/auth/google/callback`

**Callback:** `GET /api/auth/google/callback?code=...&state=...`
- **Validate `state` parameter:** Lookup in KV, reject if missing/expired (CSRF protection)
- Delete used `state` from KV
- Exchange authorization code for Google tokens
- Fetch user info (sub, email, name, picture)
- Find or create user by `google_id` (see Section 5.8 for account linking)
  - New users: use Google email + name, auto-generate username, `is_verified: true`
  - Existing users: update avatar if changed
- Generate a one-time auth code (random 32 bytes, hex-encoded), store in KV with 60-second TTL: `oauth:code:{code} = userId`
- Redirect to frontend: `{CORS_ORIGIN}/auth/callback?code={one_time_code}`
- **Frontend exchanges code for tokens:** `POST /api/auth/exchange { code }` — API validates code from KV, deletes it, issues access + refresh tokens

**New route:** `POST /api/auth/exchange { code }` (public)
- Lookup one-time code in KV
- If valid: delete code, lookup user, issue access + refresh tokens
- If invalid/expired: return 401

### 5.6 Token Refresh

`POST /api/auth/refresh`
- Read refresh token from `httpOnly` cookie
- Hash token (SHA-256, hex), lookup in `refresh_tokens` table
- Verify not revoked and not expired
- Revoke old refresh token (set `revoked = 1`)
- Issue new access + refresh token pair

### 5.7 Auth Middleware

Applied to all protected routes:
- Extract `Bearer` token from `Authorization` header
- Verify JWT signature and expiry using Web Crypto HMAC-SHA256
- Attach `{ userId }` to Hono context via `c.set()`
- Return 401 if invalid or expired

### 5.8 Account Linking Strategy

When a user authenticates via a method that returns an email already associated with an existing account:

1. **Google OAuth with existing email:** If a user registered with email/password and later authenticates via Google OAuth with the same email, auto-link the accounts: set `google_id` on the existing user record. The user can now sign in via either method. Rationale: Google has already verified the email, so ownership is proven.
2. **Phone + existing email:** Phone-only users can optionally add their email later via Settings. If the email is already taken, reject with an error and prompt them to sign in with the existing account instead.
3. **Duplicate phone:** If a Google/email user later tries phone OTP with a phone already linked to a different account, reject with an error.

### 5.9 Password Reset Flow

Included in Sub-project 1 as a basic flow using phone OTP (since we already have Hubtel integrated):

**Request reset:** `POST /api/auth/reset-password/request { email }`
- Lookup user by email
- If user has a phone number: send OTP to their phone via Hubtel
- If no phone number: return generic "if an account exists, we've sent a reset code" (email-based reset deferred to when email sending is added)

**Confirm reset:** `POST /api/auth/reset-password/confirm { email, code, new_password }`
- Verify OTP code for the user's phone
- Hash new password per Section 5.2
- Update `password_hash`, revoke all existing refresh tokens for this user
- Issue new access + refresh tokens

**Known limitation:** Users who registered with email only (no phone) cannot reset their password until email sending is integrated. This is an acceptable gap for the Ghana market where most users will have a phone number. Email-based password reset will be added when an email provider (e.g., Resend) is integrated.

---

## 6. API Design

### 6.1 Middleware Stack (applied in order)

1. **CORS** — `CORS_ORIGIN` is a comma-separated string (e.g., `"https://melodia.pages.dev,http://localhost:5173"`), parsed at startup and passed to Hono's CORS middleware as an array of allowed origins
2. **Error Handler** — Catch-all, consistent JSON error responses
3. **Rate Limiter** — Per-IP for public routes, per-user for authenticated (via KV). Note: KV is eventually consistent across edge PoPs, so rate limits may briefly exceed thresholds when requests hit different PoPs — acceptable for this use case
4. **Auth Guard** — Selective, applied to protected routes only

### 6.2 Response Formats

**Success:**
```json
{ "success": true, "data": { ... } }
```

**Error:**
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

Error codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `INTERNAL_ERROR`, `NOT_IMPLEMENTED`

### 6.3 Route Map

**Public routes (no auth):**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register with email + password |
| POST | `/api/auth/login` | Login with email + password |
| POST | `/api/auth/otp/send` | Request SMS OTP |
| POST | `/api/auth/otp/verify` | Verify SMS OTP |
| GET | `/api/auth/google` | Initiate Google OAuth |
| GET | `/api/auth/google/callback` | Google OAuth callback |
| POST | `/api/auth/exchange` | Exchange one-time code for tokens (Google OAuth) |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/reset-password/request` | Request password reset via phone OTP |
| POST | `/api/auth/reset-password/confirm` | Confirm password reset with OTP + new password |

**Protected routes (auth required):**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/me` | Get current user profile |
| POST | `/api/auth/logout` | Logout (revoke refresh token) |
| GET | `/api/credits` | Get credit balance |
| GET | `/api/credits/history` | Get transaction history |
| PUT | `/api/settings` | Update profile |

**Stub routes (return 501, ready for Sub-projects 2-6):**
- `/api/songs/*`, `/api/lyrics/*`, `/api/artwork/*`, `/api/playlists/*`, `/api/users/*`

### 6.4 Rate Limiting

KV key pattern: `rate:{scope}:{identifier}` with TTL matching the time window.

| Scope | Key | Limit |
|-------|-----|-------|
| OTP sends | `rate:otp:{phone}` | 3 per hour |
| Login attempts | `rate:login:{email\|phone}` | 10 per hour |
| API general | `rate:api:{userId}` | Plan-based |

### 6.5 Env Bindings

```typescript
// Sub-project 1 active bindings: DB, KV, and secrets only.
// R2, AI, Vectorize, Durable Objects, and Queues are typed here for
// forward compatibility but NOT bound in wrangler.toml until their
// respective sub-projects. Binding a Durable Object without exporting
// the class will cause deployment failure.

type Env = {
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
  CORS_ORIGIN: string;              // Comma-separated allowed origins

  // Added in Sub-project 2+
  R2_BUCKET: R2Bucket;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  SONG_SESSION: DurableObjectNamespace;
  GENERATION_QUEUE: Queue;
  ACE_STEP_API_URL: string;
  ACE_STEP_API_KEY: string;
};
```

### 6.6 D1 Implementation Notes

- **Booleans:** D1 (SQLite) stores booleans as `INTEGER` (0/1). All application code must use `0`/`1` in queries, not `true`/`false`. The `BOOLEAN` type in the DDL is a SQLite type affinity alias.
- **`updated_at` fields:** D1/SQLite does not support `ON UPDATE` triggers natively. All `UPDATE` queries must explicitly set `updated_at = datetime('now')` in the `SET` clause. The `queries.ts` helper will enforce this.

---

## 7. Frontend Design

### 7.1 Pages

| Route | Component | Auth | Description |
|-------|-----------|------|-------------|
| `/` | Landing | Public | Hero, features, CTA |
| `/login` | Login | Public | Tabbed: email, phone, Google |
| `/register` | Register | Public | Email + password + username |
| `/verify-otp` | VerifyOtp | Public | 6-digit OTP input |
| `/auth/callback` | AuthCallback | Public | Exchanges Google OAuth one-time code for tokens |
| `/reset-password` | ResetPassword | Public | Request + confirm password reset |
| `/dashboard` | Dashboard | Protected | Placeholder for studio |
| `/settings` | Settings | Protected | Profile, plan display |

### 7.2 Auth State Management

React Context + `useReducer` (no external state library):

- **State:** `{ user, accessToken, isLoading, isAuthenticated }`
- **On app load:** Attempt silent refresh via `POST /api/auth/refresh`
- **On API calls:** `useApi` hook attaches `Authorization: Bearer` header; on 401, attempts silent refresh; on refresh failure, redirects to `/login`
- **Token storage:** Access token in memory only (never localStorage). Refresh token as `httpOnly` cookie.

### 7.3 Styling

- Tailwind CSS with custom theme
- Dark mode default: charcoal `#1A1A2E`, midnight blue `#16213E`
- Accent colors as CSS variables: golden amber `#F0A500`, coral `#E74C3C`, teal `#00D2FF`
- No light mode toggle for MVP
- Mobile-first responsive design

---

## 8. Deployment & Configuration

### 8.1 Wrangler Configuration (Sub-project 1)

Only `DB` and `KV` bindings are active. Other bindings are added in their respective sub-projects.

```toml
name = "melodia-api"
main = "src/index.ts"
compatibility_date = "2025-12-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "melodia-db"
database_id = "<created-during-setup>"

[[kv_namespaces]]
binding = "KV"
id = "<created-during-setup>"

[vars]
ENVIRONMENT = "production"
CORS_ORIGIN = "https://melodia.pages.dev,http://localhost:5173"
MAX_FREE_SONGS_PER_DAY = "5"

# Secrets (set via wrangler secret put):
# JWT_SECRET
# HUBTEL_CLIENT_ID
# HUBTEL_CLIENT_SECRET
# HUBTEL_SENDER_ID
# GOOGLE_CLIENT_ID
# GOOGLE_CLIENT_SECRET
```

### 8.2 Secrets

| Secret | Source |
|--------|--------|
| `JWT_SECRET` | `openssl rand -hex 32` |
| `HUBTEL_CLIENT_ID` | Hubtel dashboard |
| `HUBTEL_CLIENT_SECRET` | Hubtel dashboard |
| `HUBTEL_SENDER_ID` | Hubtel dashboard (e.g., "Melodia") |
| `GOOGLE_CLIENT_ID` | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console |
| `ACE_STEP_API_URL` | GPU server (Sub-project 2) |
| `ACE_STEP_API_KEY` | Self-generated (Sub-project 2) |

### 8.3 Local Development

```bash
npm install                    # Install all workspaces
npm run dev -w apps/api        # wrangler dev
npm run dev -w apps/web        # vite dev (localhost:5173)
npx wrangler d1 execute melodia-db --local --file=apps/api/src/db/schema.sql
```

---

## 9. Out of Scope (Deferred to Later Sub-projects)

- Song generation pipeline (Sub-project 2)
- ACE-Step integration (Sub-project 2)
- R2, AI, Vectorize, Durable Objects, Queues bindings (Sub-project 2)
- Song studio UI (Sub-project 3)
- Explore, social features (Sub-project 4)
- Paystack integration, paid plans (Sub-project 5)
- LoRA training, batch generation, API access (Sub-project 6)
- Email verification flow (add when email provider like Resend is integrated)
- Email-based password reset (deferred until email provider is added — phone-based reset covers most Ghana users)
- JWT key rotation / `kid` header (add when approaching production scale)

## 10. Known Limitations

- **Email-only users cannot reset password** until email sending is integrated. Acceptable for Ghana market where most users have a phone number.
- **KV rate limiting is eventually consistent** — users hitting different Cloudflare PoPs within a short window may briefly exceed rate limits. Acceptable for OTP and login rate limiting.
- **`plan` is not in the JWT** — fetched from D1 on each request that requires authorization checks. Adds one query but avoids stale-plan bugs after upgrades.
- **No JWT key rotation** — single `JWT_SECRET`. If compromised, all tokens must be invalidated at once. Mitigated by short 15-minute access token expiry and refresh token revocation.
