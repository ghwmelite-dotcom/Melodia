<div align="center">

# MELODIA

### AI-Powered Music Generation Platform

**From a simple idea to a fully produced song — lyrics, vocals, instrumentation, and album artwork.**
**All powered by AI. Built for Africa.**

[![Built by](https://img.shields.io/badge/Built%20by-OHWPStudios-F0A500?style=for-the-badge)](https://github.com/ghwmelite-dotcom)
[![Stack](https://img.shields.io/badge/Stack-Cloudflare-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://developers.cloudflare.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![License](https://img.shields.io/badge/License-Proprietary-1A1A2E?style=for-the-badge)](#license)

---

<img src="https://img.shields.io/badge/%E2%99%AA-Melodia-F0A500?style=for-the-badge&labelColor=1A1A2E&color=F0A500" height="40" />

*"Afrobeats love song about Accra at night"*
*That's all it takes.*

</div>

---

## What is Melodia?

Melodia is an AI music generation platform that takes a user from a simple mood or idea to a **fully produced, radio-ready song** — complete with lyrics, vocals, instrumentation, and album artwork.

Think of it as having a **Grammy-winning songwriter**, a **world-class producer**, and a **professional graphic designer** on call 24/7. You provide the spark. The AI does everything else.

**Target Market:** Africa, starting from Ghana.

---

## Architecture

```
User Input → Cloudflare Worker (orchestrator)
  ├── Step 1: LLM Lyrics Engine (Workers AI)
  ├── Step 2: Music Generation (ACE-Step 1.5 — External GPU)
  ├── Step 3: Album Artwork (Workers AI — FLUX.2)
  ├── Step 4: Post-Processing (metadata, waveform, storage)
  └── Step 5: Delivery (R2 → CDN → User via WebSocket)
```

### Monorepo Structure

```
melodia/
├── apps/
│   ├── api/          → Cloudflare Workers (Hono)
│   └── web/          → React 19 + Vite + Tailwind CSS 4
├── packages/
│   └── shared/       → Valibot schemas, types, constants
└── docs/
    └── superpowers/  → Design specs & implementation plans
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **API** | [Hono](https://hono.dev) on Cloudflare Workers | Edge-native API framework |
| **Database** | Cloudflare D1 (SQLite) | Users, songs, playlists, credits |
| **Cache / Rate Limiting** | Cloudflare KV | Rate limits, OAuth state, OTP codes |
| **Storage** | Cloudflare R2 | Audio files, artwork, stems |
| **Frontend** | React 19 + Vite 6 | SPA with code-split routing |
| **Styling** | Tailwind CSS 4 | Dark theme, custom design tokens |
| **Validation** | Valibot | Shared schemas (API + frontend) |
| **Auth** | Web Crypto API | PBKDF2 passwords, HMAC-SHA256 JWT |
| **SMS OTP** | Hubtel | Ghana-native SMS delivery |
| **OAuth** | Google | Social login |
| **Payments** | Paystack | GHS, Mobile Money, cards *(Sub-project 5)* |
| **Music AI** | ACE-Step 1.5 | Full song generation with vocals |
| **Lyrics AI** | Workers AI (Llama / Qwen) | Structured lyrics with section markers |
| **Artwork AI** | Workers AI (FLUX.2) | Album cover generation |
| **IDs** | ULIDs | Time-sortable, URL-friendly |

---

## Features

### Implemented (Sub-project 1)

- [x] **Monorepo scaffold** — npm workspaces, shared TypeScript config
- [x] **Full D1 schema** — 9 tables, 10 indexes, ULID primary keys
- [x] **Email + password auth** — PBKDF2 (600K iterations), JWT access/refresh tokens
- [x] **Phone OTP auth** — Hubtel SMS integration for Ghana (+233)
- [x] **Google OAuth** — Secure one-time code exchange pattern
- [x] **Account linking** — Auto-link Google accounts by verified email
- [x] **Password reset** — Phone OTP-based reset flow
- [x] **Rate limiting** — KV-backed, per-user and per-IP
- [x] **CSRF protection** — SameSite=Strict cookies + Bearer tokens
- [x] **React frontend** — Dark theme, tabbed login, OTP verification
- [x] **Auth state management** — Context + silent token refresh
- [x] **Typed API client** — Auto-retry on 401 with token refresh

### Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| **Sub-project 1** | Scaffold, Database, Auth | **Done** |
| **Sub-project 2** | Song Generation Pipeline | Planned |
| **Sub-project 3** | React Studio UI | Planned |
| **Sub-project 4** | Library, Explore, Social | Planned |
| **Sub-project 5** | Paystack, Credits, Pricing | Planned |
| **Sub-project 6** | Advanced Features (LoRA, Stems, API) | Planned |

---

## Getting Started

### Prerequisites

- Node.js 20+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm i -g wrangler`)

### Setup

```bash
# Clone
git clone https://github.com/ghwmelite-dotcom/Melodia.git
cd Melodia

# Install dependencies
npm install

# Set up local secrets
cat > apps/api/.dev.vars << 'EOF'
JWT_SECRET=your-secret-here
HUBTEL_CLIENT_ID=your-hubtel-id
HUBTEL_CLIENT_SECRET=your-hubtel-secret
HUBTEL_SENDER_ID=Melodia
GOOGLE_CLIENT_ID=your-google-id
GOOGLE_CLIENT_SECRET=your-google-secret
EOF

# Initialize local database
npm run db:migrate:local -w apps/api

# Start development
npm run dev:api   # API on http://localhost:8787
npm run dev:web   # Frontend on http://localhost:5173
```

### API Endpoints

<details>
<summary><strong>Authentication</strong></summary>

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Register with email + password |
| `POST` | `/api/auth/login` | Login with email + password |
| `POST` | `/api/auth/otp/send` | Request SMS OTP |
| `POST` | `/api/auth/otp/verify` | Verify SMS OTP |
| `GET` | `/api/auth/google` | Initiate Google OAuth |
| `GET` | `/api/auth/google/callback` | Google OAuth callback |
| `POST` | `/api/auth/exchange` | Exchange OAuth code for tokens |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `POST` | `/api/auth/reset-password/request` | Request password reset |
| `POST` | `/api/auth/reset-password/confirm` | Confirm password reset |
| `GET` | `/api/auth/me` | Get current user profile |
| `POST` | `/api/auth/logout` | Logout |

</details>

<details>
<summary><strong>Credits & Settings</strong></summary>

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/credits` | Get credit balance |
| `GET` | `/api/credits/history` | Get transaction history |
| `PUT` | `/api/settings` | Update profile |

</details>

---

## Security

- **Passwords**: PBKDF2 with SHA-256, 600,000 iterations, 16-byte random salt
- **Tokens**: JWT (HMAC-SHA256, 15-min expiry) + httpOnly refresh cookies (7-day, rotated)
- **CSRF**: SameSite=Strict cookies + Authorization Bearer header requirement
- **OAuth**: State parameter with KV-backed CSRF validation
- **Rate Limiting**: KV-backed per-user and per-IP limits
- **SQL**: All queries use prepared statements (zero string concatenation)
- **OTP**: Previous codes invalidated on new send, max 3 attempts per code

---

## Design System

| Token | Value | Usage |
|-------|-------|-------|
| `charcoal` | `#1A1A2E` | Primary background |
| `midnight` | `#16213E` | Nav, elevated surfaces |
| `amber` | `#F0A500` | Primary accent, CTAs |
| `coral` | `#E74C3C` | Errors, destructive actions |
| `teal` | `#00D2FF` | Success, info states |
| `surface-1` | `#1E1E36` | Cards |
| `surface-2` | `#252542` | Inputs, secondary cards |
| `surface-3` | `#2D2D50` | Borders, dividers |

---

## Project Structure

```
apps/api/src/
├── index.ts                 # Hono app entry point
├── types.ts                 # Env bindings + Hono variables
├── db/
│   ├── schema.sql           # Full D1 schema (9 tables)
│   └── queries.ts           # Prepared statement helpers
├── middleware/
│   ├── auth.ts              # JWT verification guard
│   ├── cors.ts              # Multi-origin CORS
│   ├── error-handler.ts     # AppError + global handler
│   └── rate-limit.ts        # KV-backed rate limiting
├── routes/
│   ├── auth.ts              # All auth endpoints
│   ├── credits.ts           # Credit balance + history
│   ├── settings.ts          # Profile management
│   └── [stubs]              # songs, lyrics, artwork, playlists, users
└── services/
    ├── auth.service.ts       # PBKDF2, JWT, token management
    ├── otp.service.ts        # Hubtel SMS OTP
    └── google.service.ts     # Google OAuth flow

apps/web/src/
├── main.tsx                 # App entry
├── App.tsx                  # Router (code-split)
├── hooks/
│   ├── useAuth.ts           # Auth context + silent refresh
│   └── useApi.ts            # API call state management
├── lib/
│   └── api.ts               # Typed API client
├── components/
│   ├── AuthGuard.tsx         # Protected route wrapper
│   └── Layout.tsx            # App shell with nav
└── pages/
    ├── Landing.tsx           # Public hero page
    ├── Login.tsx             # Tabbed (email/phone/Google)
    ├── Register.tsx          # Email registration
    ├── VerifyOtp.tsx         # 6-digit OTP input
    ├── AuthCallback.tsx      # Google OAuth code exchange
    ├── ResetPassword.tsx     # 2-step password reset
    ├── Dashboard.tsx         # Protected home
    └── Settings.tsx          # Profile management
```

---

## Pricing Plans

| Plan | Price | Credits/Day | Variations | Downloads |
|------|-------|-------------|------------|-----------|
| **Free** | GHS 0 | 5 | 2 | MP3 |
| **Creator** | GHS 150/mo | 50 | 4 | WAV + MP3 |
| **Pro** | GHS 450/mo | Unlimited | 8 | WAV + MP3 + FLAC |
| **Enterprise** | Custom | Unlimited | Custom | All formats |

*Payments via Paystack — Cards, Mobile Money (MTN MoMo, Vodafone Cash, AirtelTigo)*

---

## Contributing

Melodia is currently in active development. Contributions welcome — please open an issue first to discuss what you'd like to change.

---

<div align="center">

### Built with precision by [OHWPStudios](https://github.com/ghwmelite-dotcom)

A product of **Hodges & Co. Limited**

---

*Making world-class music creation accessible to every creator in Africa and beyond.*

</div>
